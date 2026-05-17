export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { verify } from '@/lib/verifier'
import { generateReceipt } from '@/lib/receipt'
import type { Domain } from '@/lib/invariants/types'

const VALID_DOMAINS: Domain[] = [
  'medical', 'legal', 'military', 'robotics',
  'nuclear', 'aviation', 'finance', 'pharmaceutical',
  'critical_infrastructure', 'criminal_justice',
]

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { decision, context, domain, model } = body

    if (!decision || typeof decision !== 'string') {
      return NextResponse.json({ error: 'decision is required' }, { status: 400 })
    }
    if (!VALID_DOMAINS.includes(domain)) {
      return NextResponse.json({ error: `domain must be one of: ${VALID_DOMAINS.join(', ')}` }, { status: 400 })
    }

    const result = await verify({
      decision,
      context: context ?? '',
      domain,
      model: model ?? 'unknown',
    })

    const receipt = generateReceipt(decision, model ?? 'unknown', domain, result)

    return NextResponse.json({ receipt, verification: result })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
