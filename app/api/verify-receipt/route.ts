export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { verifyReceiptSignature } from '@/lib/receipt'
import type { ProofnodeReceipt } from '@/lib/invariants/types'

export async function POST(req: NextRequest) {
  try {
    const receipt = await req.json() as ProofnodeReceipt
    if (!receipt?.signature || !receipt?.public_key) {
      return NextResponse.json({ valid: false, error: 'Missing signature or public_key' }, { status: 400 })
    }
    const valid = verifyReceiptSignature(receipt)
    return NextResponse.json({ valid, receipt_id: receipt.id, verdict: receipt.verdict, domain: receipt.domain })
  } catch {
    return NextResponse.json({ valid: false, error: 'Invalid receipt format' }, { status: 400 })
  }
}
