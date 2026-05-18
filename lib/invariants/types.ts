export type Domain =
  | 'medical'
  | 'legal'
  | 'military'
  | 'robotics'
  | 'nuclear'
  | 'aviation'
  | 'finance'
  | 'pharmaceutical'
  | 'critical_infrastructure'
  | 'criminal_justice'

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

export interface NexumReceipt {
  id: string
  timestamp: string
  domain: Domain
  model: string
  decision_hash: string
  decision_preview: string
  verdict: 'COMPLIANT' | 'VIOLATION' | 'ERROR'
  extracted_params: Record<string, boolean | number>
  extraction_method: 'claude' | 'heuristic'
  invariants_checked: Array<{ id: string; description: string; passed: boolean }>
  violations: Array<{ id: string; description: string }>
  z3_result: 'SAT' | 'UNSAT' | 'UNKNOWN'
  analysis: string
  stage_timings: { extract_ms: number; z3_ms: number; sign_ms: number }
  hardware_source: 'software_mock' | 'fpga_risc_v'
  signature: string
  public_key: string
}
