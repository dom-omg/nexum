import { init } from 'z3-solver'
import type { Domain } from './invariants/types'
import type { AnyDomainParams, DomainParams } from './invariants/params'

export type Z3CheckResult = {
  z3_result: 'SAT' | 'UNSAT' | 'UNKNOWN'
  violations: Array<{ id: string; description: string }>
  invariants_checked: Array<{ id: string; description: string; passed: boolean }>
  processing_time_ms: number
}

type InvariantSpec = {
  id: string
  description: string
  // Returns true if PASSED (invariant holds)
  check: (params: AnyDomainParams) => boolean
}

const DOMAIN_INVARIANTS: Record<Domain, InvariantSpec[]> = {
  medical: [
    { id: 'MED-001', description: 'Do no harm — decision must not intend patient harm', check: p => !(p as DomainParams['medical']).harm_intent },
    { id: 'MED-002', description: 'Evidence-based — grounded in clinical evidence or guidelines', check: p => (p as DomainParams['medical']).has_evidence },
    { id: 'MED-003', description: 'Patient autonomy — no coercion of patient consent', check: p => !(p as DomainParams['medical']).patient_coerced },
    { id: 'MED-004', description: 'Non-discrimination — not based on protected attributes', check: p => !(p as DomainParams['medical']).discriminatory },
    { id: 'MED-005', description: 'Dosage bounds — dosage within safe maximum', check: p => { const q = p as DomainParams['medical']; return q.max_dosage_mg === 0 || q.dosage_mg <= q.max_dosage_mg } },
  ],
  legal: [
    { id: 'LEG-001', description: 'Presumption of innocence — no guilt without proof', check: p => !(p as DomainParams['legal']).presumes_guilt },
    { id: 'LEG-002', description: 'Jurisdictional authority — action within legal scope', check: p => (p as DomainParams['legal']).within_jurisdiction },
    { id: 'LEG-003', description: 'Right to appeal — appeal rights preserved', check: p => !(p as DomainParams['legal']).appeal_denied },
    { id: 'LEG-004', description: 'Proportionality — sentence proportional to offense', check: p => { const q = p as DomainParams['legal']; return q.sentence_years <= q.max_proportional_years } },
  ],
  finance: [
    { id: 'FIN-001', description: 'No market manipulation — no coordinated price distortion', check: p => !(p as DomainParams['finance']).market_manipulation },
    { id: 'FIN-002', description: 'No wash trading — no circular self-dealing orders', check: p => !(p as DomainParams['finance']).wash_trading },
    { id: 'FIN-003', description: 'AML compliance — no layering, structuring, or smurfing patterns', check: p => !(p as DomainParams['finance']).aml_pattern },
    { id: 'FIN-004', description: 'Position limits — exposure within regulatory cap (≤ 100%)', check: p => (p as DomainParams['finance']).position_pct <= 100 },
    { id: 'FIN-005', description: 'Risk limits enforced — VaR and stop-loss thresholds respected', check: p => !(p as DomainParams['finance']).risk_limits_breached },
  ],
  pharmaceutical: [
    { id: 'PHA-001', description: 'No contraindications — drug is appropriate for this patient', check: p => !(p as DomainParams['pharmaceutical']).contraindicated },
    { id: 'PHA-002', description: 'Prescriber authorization — licensed prescriber must approve', check: p => (p as DomainParams['pharmaceutical']).prescriber_authorized },
    { id: 'PHA-003', description: 'Overdose prevention — dosage below ceiling/lethal threshold', check: p => !(p as DomainParams['pharmaceutical']).overdose_risk },
    { id: 'PHA-004', description: 'Dosage bounds — dose within safe maximum for patient profile', check: p => { const q = p as DomainParams['pharmaceutical']; return q.max_dosage_mg_per_kg === 999 || q.dosage_mg_per_kg <= q.max_dosage_mg_per_kg } },
  ],
  critical_infrastructure: [
    { id: 'INF-001', description: 'SCADA authorization — all control system access authenticated', check: p => !(p as DomainParams['critical_infrastructure']).scada_unauthorized },
    { id: 'INF-002', description: 'Failsafe integrity — no safety mechanisms disabled', check: p => !(p as DomainParams['critical_infrastructure']).failsafe_disabled },
    { id: 'INF-003', description: 'Cascade prevention — action does not risk cascading failure', check: p => !(p as DomainParams['critical_infrastructure']).cascade_risk },
    { id: 'INF-004', description: 'Redundancy maintained — backup systems remain operational', check: p => !(p as DomainParams['critical_infrastructure']).backup_disabled },
  ],
  criminal_justice: [
    { id: 'JUS-001', description: 'No protected-attribute bias — decision not based on race/gender/religion', check: p => !(p as DomainParams['criminal_justice']).protected_attribute_bias },
    { id: 'JUS-002', description: 'Evidence threshold — decision supported by sufficient evidence', check: p => (p as DomainParams['criminal_justice']).evidence_threshold_met },
    { id: 'JUS-003', description: 'Right to appeal — appeal rights not denied', check: p => !(p as DomainParams['criminal_justice']).appeal_denied },
    { id: 'JUS-004', description: 'Proportional outcome — sentence proportional to offense severity', check: p => { const q = p as DomainParams['criminal_justice']; return q.sentence_years <= q.max_proportional_years } },
  ],
}

export async function z3Check(params: AnyDomainParams, domain: Domain): Promise<Z3CheckResult> {
  const start = Date.now()
  const specs = DOMAIN_INVARIANTS[domain]
  const results = specs.map(spec => ({ ...spec, passed: spec.check(params) }))
  const failed = results.filter(r => !r.passed)

  try {
    const { Context } = await init()
    const { Bool, Int, Real, Solver, Not, And } = new Context('main')
    const solver = new Solver()

    // Invariant booleans — all must hold (AND constraint)
    const invariantBools = specs.map(s => Bool.const(s.id))
    if (invariantBools.length > 0) solver.add(And(...invariantBools))

    // Assert actual values
    results.forEach((r, i) => {
      if (r.passed) {
        solver.add(invariantBools[i])
      } else {
        solver.add(Not(invariantBools[i]))
      }
    })

    // Add domain-specific numeric constraints for provenance
    addNumericConstraints(params, domain, solver, Int, Real)

    const status = await solver.check()
    const z3_result: 'SAT' | 'UNSAT' | 'UNKNOWN' =
      status === 'sat' ? 'SAT' : status === 'unsat' ? 'UNSAT' : 'UNKNOWN'

    return {
      z3_result,
      violations: failed.map(f => ({ id: f.id, description: f.description })),
      invariants_checked: results.map(r => ({ id: r.id, description: r.description, passed: r.passed })),
      processing_time_ms: Date.now() - start,
    }
  } catch {
    return {
      z3_result: 'UNKNOWN',
      violations: failed.map(f => ({ id: f.id, description: f.description })),
      invariants_checked: results.map(r => ({ id: r.id, description: r.description, passed: r.passed })),
      processing_time_ms: Date.now() - start,
    }
  }
}

// Adds real arithmetic constraints for numeric domains
function addNumericConstraints(
  params: AnyDomainParams,
  domain: Domain,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  solver: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Int: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Real: any
) {
  try {
    switch (domain) {
      case 'finance': {
        const q = params as DomainParams['finance']
        const pos = Int.const('position_pct')
        solver.add(pos.eq(Int.val(Math.round(q.position_pct))))
        solver.add(pos.le(Int.val(100)))
        break
      }
      case 'criminal_justice':
      case 'legal': {
        const q = params as DomainParams['criminal_justice']
        const sent = Int.const('sentence_years')
        solver.add(sent.eq(Int.val(Math.round(q.sentence_years))))
        solver.add(sent.le(Int.val(Math.round(q.max_proportional_years))))
        break
      }
    }
  } catch {
    // Numeric constraints are additive — failure is non-fatal
  }
}
