export const runtime = 'nodejs'

import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { extractParams } from '@/lib/extractor'
import { bridge } from '@/lib/fpga/bridge'
import { generateReceipt } from '@/lib/receipt'
import { buildAuditReport } from '@/lib/compliance/report'
import type { Domain, ProofnodeReceipt } from '@/lib/invariants/types'

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

async function generateExecutiveSummary(
  system_name: string,
  domain: Domain,
  compliance_rate: number,
  risk_level: string,
  top_violations: Array<{ id: string; description: string; violation_rate: number }>,
  total: number,
): Promise<string> {
  const client = getAnthropic()
  if (!client) {
    const pct = Math.round(compliance_rate * 100)
    const viol = top_violations.length > 0
      ? ` Key violations: ${top_violations.map(v => `${v.id} (${Math.round(v.violation_rate * 100)}%)`).join(', ')}.`
      : ' No invariant violations detected.'
    return `${system_name} audit complete. Domain: ${domain.toUpperCase()}. Compliance rate: ${pct}% across ${total} test decisions. Risk classification: ${risk_level}.${viol} Report signed by PROOFNODE formal verification engine.`
  }
  try {
    const violStr = top_violations.length > 0
      ? top_violations.map(v => `- ${v.id} (${Math.round(v.violation_rate * 100)}% violation rate): ${v.description}`).join('\n')
      : 'None'
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: `Write a 3-sentence executive summary for an AI compliance audit report.

System: ${system_name}
Domain: ${domain}
Compliance rate: ${Math.round(compliance_rate * 100)}% (${total} decisions tested)
Risk level: ${risk_level}
Top violations:
${violStr}

Be direct, technical, and suitable for a regulatory submission. Do not use bullet points.`,
      }],
    })
    return msg.content[0].type === 'text' ? msg.content[0].text.trim() : ''
  } catch {
    return `${system_name} formal audit completed by PROOFNODE. ${Math.round(compliance_rate * 100)}% compliance across ${total} test decisions. Risk level: ${risk_level}.`
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { system_name, domain, test_cases, model } = body as {
    system_name: string
    domain: Domain
    test_cases: Array<{ decision: string; context?: string }>
    model?: string
  }

  if (!system_name || !VALID_DOMAINS.includes(domain) || !Array.isArray(test_cases) || test_cases.length === 0) {
    return new Response(JSON.stringify({ error: 'Invalid request' }), { status: 400 })
  }

  const cases = test_cases.slice(0, 20) // cap at 20 for demo

  const { readable, writable } = new TransformStream()
  const writer = writable.getWriter()
  const enc = new TextEncoder()
  const send = (data: Record<string, unknown>) => {
    writer.write(enc.encode(`data: ${JSON.stringify(data)}\n\n`))
  }

  ;(async () => {
    const receipts: ProofnodeReceipt[] = []
    try {
      send({ stage: 'start', total: cases.length, system_name, domain })

      for (let i = 0; i < cases.length; i++) {
        const tc = cases[i]
        send({ stage: 'case_start', index: i, total: cases.length, preview: tc.decision.slice(0, 80) })

        const t0 = Date.now()
        const { params, method } = await extractParams(tc.decision, tc.context ?? '', domain)
        const extract_ms = Date.now() - t0

        const t1 = Date.now()
        const z3Result = await bridge.verify(params, domain)
        const z3_ms = Date.now() - t1

        const receipt = generateReceipt({
          decision: tc.decision,
          model: model ?? 'unknown',
          domain,
          extracted_params: params,
          extraction_method: method,
          z3: z3Result,
          analysis: '',
          hardware_source: bridge.hardwareSource(),
          stage_timings: { extract_ms, z3_ms, sign_ms: 0 },
        })

        receipts.push(receipt)
        send({
          stage: 'case_done',
          index: i,
          total: cases.length,
          verdict: receipt.verdict,
          violations: z3Result.violations,
          receipt_id: receipt.id,
        })
      }

      // Build report
      send({ stage: 'report', status: 'generating' })
      const complianceRate = receipts.filter(r => r.verdict === 'COMPLIANT').length / receipts.length
      const topViolations = Array.from(
        receipts.flatMap(r => r.violations).reduce((map, v) => {
          const e = map.get(v.id) ?? { id: v.id, description: v.description, count: 0 }
          e.count++
          map.set(v.id, e)
          return map
        }, new Map<string, { id: string; description: string; count: number }>())
        .values()
      ).map(v => ({ ...v, violation_rate: v.count / receipts.length }))
        .sort((a, b) => b.violation_rate - a.violation_rate)
        .slice(0, 3)

      // Determine risk level for summary
      const hasCritical = ['JUS-001', 'MED-004', 'INF-001'].some(id => topViolations.some(v => v.id === id))
      const risk_level =
        hasCritical ? 'UNACCEPTABLE' :
        complianceRate < 0.75 ? 'UNACCEPTABLE' :
        complianceRate < 0.95 ? 'HIGH' : 'HIGH'

      const executive_summary = await generateExecutiveSummary(
        system_name, domain, complianceRate, risk_level, topViolations, receipts.length
      )

      const report = buildAuditReport({ system_name, domain, receipts, executive_summary })
      send({ stage: 'complete', report })
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
