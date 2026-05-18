import crypto from 'crypto'
import type { NexumReceipt, Domain, VerificationResult } from './invariants/types'

// Ed25519 keypair — in production, stored in FPGA secure enclave
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

export function generateReceipt(
  decision: string,
  model: string,
  domain: Domain,
  result: VerificationResult
): NexumReceipt {
  const id = crypto.randomUUID()
  const timestamp = new Date().toISOString()
  const decision_hash = crypto.createHash('sha256').update(decision).digest('hex')
  const decision_preview = decision.slice(0, 120) + (decision.length > 120 ? '…' : '')

  const { privateKey, publicKey } = getKeypair()

  const payload = JSON.stringify({
    id,
    timestamp,
    domain,
    model,
    decision_hash,
    verdict: result.verdict,
    invariants_checked: result.invariants_checked,
    violations: result.violations,
    hardware_source: result.hardware_source,
  })

  const sign = crypto.createSign('SHA256')
  sign.update(payload)
  const signature = sign.sign(privateKey, 'hex')

  return {
    id,
    timestamp,
    domain,
    model,
    decision_hash,
    decision_preview,
    verdict: result.verdict,
    invariants_checked: result.invariants_checked,
    violations: result.violations,
    hardware_source: result.hardware_source,
    signature,
    public_key: publicKey,
  }
}
