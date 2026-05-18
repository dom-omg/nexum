export const runtime = 'nodejs'

import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { extractParams } from '@/lib/extractor'
import { bridge } from '@/lib/fpga/bridge'
import { generateReceipt } from '@/lib/receipt'
import type { Domain } from '@/lib/invariants/types'

const VALID_DOMAINS: Domain[] = [
  'medical', 'legal', 'finance', 'pharmaceutical',
  'critical_infrastructure', 'criminal_justice',
]

let _anthropic: Anthropic | null = null
function getAnthropic(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null
  if (!_anthropic) _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  return _anthropic
}

async function generateAnalysis(
  decision: string,
  domain: Domain,
  verdict: 'COMPLIANT' | 'VIOLATION',
  violations: Array<{ id: string; description: string }>
): Promise<string> {
  const client = getAnthropic()
  if (!client) {
    if (verdict === 'COMPLIANT') return `Decision satisfies all ${domain} formal invariants. Z3 solver confirms SAT — no constraint violations detected.`
    return `Decision violates ${violations.length} invariant(s): ${violations.map(v => v.id).join(', ')}. Z3 solver returned UNSAT — formal constraints cannot be simultaneously satisfied.`
  }
  try {
    const violationStr = violations.length > 0
      ? `VIOLATIONS:\n${violations.map(v => `• ${v.id}: ${v.description}`).join('\n')}`
      : 'No violations detected.'
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      messages: [{
        role: 'user',
        content: `You are a formal safety verifier. In exactly 2 sentences, explain why this AI decision is ${verdict} under formal ${domain} safety invariants.

Decision: ${decision.slice(0, 300)}
${violationStr}

Be precise and technical. Mention specific invariants by ID if violated.`,
      }],
    })
    return msg.content[0].type === 'text' ? msg.content[0].text.trim() : ''
  } catch {
    return verdict === 'COMPLIANT'
      ? `All ${domain} safety invariants satisfied. Z3 confirms SAT.`
      : `Invariants ${violations.map(v => v.id).join(', ')} violated. Z3 UNSAT.`
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { decision, context, domain, model } = body

  if (!decision || typeof decision !== 'string') {
    return new Response(JSON.stringify({ error: 'decision is required' }), { status: 400 })
  }
  if (!VALID_DOMAINS.includes(domain)) {
    return new Response(JSON.stringify({ error: `invalid domain` }), { status: 400 })
  }

  const { readable, writable } = new TransformStream()
  const writer = writable.getWriter()
  const enc = new TextEncoder()

  const send = (data: Record<string, unknown>) => {
    writer.write(enc.encode(`data: ${JSON.stringify(data)}\n\n`))
  }

  ;(async () => {
    const timings = { extract_ms: 0, z3_ms: 0, sign_ms: 0 }
    try {
      // ── Stage 1: Extract ────────────────────────────────────────────────────
      send({ stage: 'extract', status: 'start' })
      const t0 = Date.now()
      const { params, method } = await extractParams(decision, context ?? '', domain)
      timings.extract_ms = Date.now() - t0
      send({ stage: 'extract', status: 'done', params, method, elapsed_ms: timings.extract_ms })

      // ── Stage 2: Z3 Formal Verification ────────────────────────────────────
      send({ stage: 'verify', status: 'start' })
      const t1 = Date.now()
      const z3Result = await bridge.verify(params, domain)
      timings.z3_ms = Date.now() - t1
      send({
        stage: 'verify',
        status: 'done',
        z3_result: z3Result.z3_result,
        violations: z3Result.violations,
        invariants_checked: z3Result.invariants_checked,
        elapsed_ms: timings.z3_ms,
      })

      // ── Stage 3: Analysis + Sign ────────────────────────────────────────────
      send({ stage: 'sign', status: 'start' })
      const t2 = Date.now()
      const verdict = z3Result.violations.length === 0 ? 'COMPLIANT' : 'VIOLATION'
      const [analysis] = await Promise.all([
        generateAnalysis(decision, domain, verdict, z3Result.violations),
      ])
      const receipt = generateReceipt({
        decision,
        model: model ?? 'unknown',
        domain,
        extracted_params: params,
        extraction_method: method,
        z3: z3Result,
        analysis,
        hardware_source: bridge.hardwareSource(),
        stage_timings: { ...timings, sign_ms: Date.now() - t2 },
      })
      timings.sign_ms = Date.now() - t2
      send({ stage: 'sign', status: 'done', elapsed_ms: timings.sign_ms })

      // ── Complete ────────────────────────────────────────────────────────────
      send({ stage: 'complete', receipt })
    } catch (err) {
      send({ stage: 'error', message: String(err) })
    } finally {
      writer.close()
    }
  })()

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
