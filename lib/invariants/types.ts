export type Domain = 'medical' | 'legal' | 'military' | 'robotics'

export interface Invariant {
  id: string
  description: string
  constraint: string // Z3 expression
}

export interface VerificationInput {
  decision: string
  context: string
  domain: Domain
  model: string
}

export interface VerificationResult {
  verdict: 'COMPLIANT' | 'VIOLATION' | 'ERROR'
  invariants_checked: string[]
  violations: string[]
  z3_result: 'SAT' | 'UNSAT' | 'UNKNOWN'
  hardware_source: 'software_mock' | 'fpga_risc_v'
  processing_time_ms: number
}

export interface AxiomReceipt {
  id: string
  timestamp: string
  domain: Domain
  model: string
  decision_hash: string
  decision_preview: string
  verdict: 'COMPLIANT' | 'VIOLATION' | 'ERROR'
  invariants_checked: string[]
  violations: string[]
  hardware_source: 'software_mock' | 'fpga_risc_v'
  signature: string
  public_key: string
}
