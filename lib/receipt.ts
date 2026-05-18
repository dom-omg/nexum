import crypto from 'crypto'
import type { NexumReceipt, Domain } from './invariants/types'
import type { Z3CheckResult } from './z3-checker'
import type { AnyDomainParams } from './invariants/params'
import type { HardwareSource } from './fpga/bridge'

// Ed25519 keypair — in production, persisted in FPGA secure enclave
let _keypair: { publicKey: string; privateKey: string } | null = null

function getKeypair() {
  if (!_keypair) {
    const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519')
    _keypair = {
      privateKey: privateKey.export({ type: 'pkcs8', format: 'pem' }) as string,
      publicKey: publicKey.export({ type: 'spki', format: 'pem' }) as string,
    }
  }
  return _keypair
}

export function generateReceipt(opts: {
  decision: string
  model: string
  domain: Domain
  extracted_params: AnyDomainParams
  extraction_method: 'claude' | 'heuristic'
  z3: Z3CheckResult
  analysis: string
  hardware_source: HardwareSource
  stage_timings: { extract_ms: number; z3_ms: number; sign_ms: number }
}): NexumReceipt {
  const id = crypto.randomUUID()
  const timestamp = new Date().toISOString()
  const decision_hash = crypto.createHash('sha256').update(opts.decision).digest('hex')
  const decision_preview = opts.decision.slice(0, 120) + (opts.decision.length > 120 ? '…' : '')
  const verdict = opts.z3.violations.length === 0 ? 'COMPLIANT' : 'VIOLATION'

  const { privateKey, publicKey } = getKeypair()

  const payload = JSON.stringify({
    id,
    timestamp,
    domain: opts.domain,
    model: opts.model,
    decision_hash,
    verdict,
    violations: opts.z3.violations,
    z3_result: opts.z3.z3_result,
    hardware_source: opts.hardware_source,
  })

  const sign = crypto.createSign('SHA256')
  sign.update(payload)
  const signature = sign.sign(privateKey, 'hex')

  return {
    id,
    timestamp,
    domain: opts.domain,
    model: opts.model,
    decision_hash,
    decision_preview,
    verdict,
    extracted_params: opts.extracted_params as Record<string, boolean | number>,
    extraction_method: opts.extraction_method,
    invariants_checked: opts.z3.invariants_checked,
    violations: opts.z3.violations,
    z3_result: opts.z3.z3_result,
    analysis: opts.analysis,
    stage_timings: opts.stage_timings,
    hardware_source: opts.hardware_source,
    signature,
    public_key: publicKey,
  }
}

export function verifyReceiptSignature(receipt: NexumReceipt): boolean {
  try {
    const payload = JSON.stringify({
      id: receipt.id,
      timestamp: receipt.timestamp,
      domain: receipt.domain,
      model: receipt.model,
      decision_hash: receipt.decision_hash,
      verdict: receipt.verdict,
      violations: receipt.violations,
      z3_result: receipt.z3_result,
      hardware_source: receipt.hardware_source,
    })
    const verify = crypto.createVerify('SHA256')
    verify.update(payload)
    return verify.verify(receipt.public_key, receipt.signature, 'hex')
  } catch {
    return false
  }
}
