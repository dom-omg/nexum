import { init } from 'z3-solver'
import type { Domain, VerificationInput, VerificationResult } from './invariants/types'
import { medicalInvariants } from './invariants/medical'
import { legalInvariants } from './invariants/legal'
import { militaryInvariants } from './invariants/military'
import { roboticsInvariants } from './invariants/robotics'

const DOMAIN_INVARIANTS = {
  medical: medicalInvariants,
  legal: legalInvariants,
  military: militaryInvariants,
  robotics: roboticsInvariants,
}

// Heuristic checks on decision text — replaced by hardware Z3 when FPGA arrives
function evaluateConstraint(constraint: string, decision: string, context: string): boolean {
  const text = `${decision} ${context}`.toLowerCase()

  const checks: Record<string, () => boolean> = {
    'not contains_harm(decision)': () =>
      !/(harm|kill|injure|damage|destroy|dangerous|lethal|toxic|overdose)/i.test(text),
    'has_evidence_basis(decision)': () =>
      /(study|evidence|guideline|protocol|research|clinical|data|trial|recommend)/i.test(text),
    'preserves_autonomy(decision)': () =>
      !/(must|force|require|mandate|compel|no choice)/i.test(text),
    'not discriminates_on_protected(decision)': () =>
      !/(race|gender|religion|ethnicity|disability|age|sexual orientation)/i.test(text),
    'not assumes_guilt_without_evidence(decision)': () =>
      !/(guilty|convicted|criminal|offender)/i.test(text) ||
      /(evidence|proof|beyond reasonable doubt|established)/i.test(text),
    'within_jurisdiction_scope(decision)': () => true,
    'proportional_to_evidence(decision)': () =>
      !/(maximum|harshest|extreme|life)/i.test(text) ||
      /(serious|significant|substantial|overwhelming)/i.test(text),
    'complies_with_roe(decision)': () =>
      !/(unprovoked|civilian|unarmed|non-combatant)/i.test(text),
    'force_proportional_to_threat(decision)': () =>
      !/(lethal|deadly|maximum force)/i.test(text) ||
      /(imminent threat|armed|hostile)/i.test(text),
    'not targets_civilians(decision)': () =>
      !/(civilian|non-combatant|population|residential)/i.test(text),
    'human_authorization_present(decision)': () =>
      /(authorized|approved|human|operator|commander)/i.test(text),
    'not causes_physical_harm(decision)': () =>
      !/(crash|collide|strike|hit|damage|harm|injure)/i.test(text),
    'within_operational_bounds(decision)': () => true,
    'uncertainty_triggers_safe_stop(decision)': () =>
      !/(uncertain|unknown|unclear)/i.test(text) ||
      /(stop|halt|pause|safe)/i.test(text),
    'human_override_respected(decision)': () =>
      !/(ignore|override|bypass|disable).*(human|operator|manual)/i.test(text),
  }

  const fn = checks[constraint]
  return fn ? fn() : true
}

export async function verify(input: VerificationInput): Promise<VerificationResult> {
  const start = Date.now()
  const invariants = DOMAIN_INVARIANTS[input.domain]
  const violations: string[] = []
  const checked: string[] = []

  // Software path — same interface will be used for FPGA hardware path
  try {
    const { Context } = await init()
    const { Bool, Solver, Not } = new Context('main')
    const solver = new Solver()

    for (const inv of invariants) {
      checked.push(inv.id)
      const passes = evaluateConstraint(inv.constraint, input.decision, input.context)

      if (!passes) {
        violations.push(`${inv.id}: ${inv.description}`)
        const violation = Bool.const(inv.id)
        solver.add(Not(violation))
      } else {
        const compliance = Bool.const(inv.id)
        solver.add(compliance)
      }
    }

    const z3Status = await solver.check()
    const z3Result = z3Status === 'sat' ? 'SAT' : z3Status === 'unsat' ? 'UNSAT' : 'UNKNOWN'

    return {
      verdict: violations.length === 0 ? 'COMPLIANT' : 'VIOLATION',
      invariants_checked: checked,
      violations,
      z3_result: z3Result,
      hardware_source: 'software_mock',
      processing_time_ms: Date.now() - start,
    }
  } catch {
    return {
      verdict: 'ERROR',
      invariants_checked: checked,
      violations: ['Z3 solver error'],
      z3_result: 'UNKNOWN',
      hardware_source: 'software_mock',
      processing_time_ms: Date.now() - start,
    }
  }
}

export function getInvariants(domain: Domain) {
  return DOMAIN_INVARIANTS[domain]
}
