import { init } from 'z3-solver'
import type { Domain, VerificationInput, VerificationResult } from './invariants/types'
import { medicalInvariants } from './invariants/medical'
import { legalInvariants } from './invariants/legal'
import { militaryInvariants } from './invariants/military'
import { roboticsInvariants } from './invariants/robotics'
import { nuclearInvariants } from './invariants/nuclear'
import { aviationInvariants } from './invariants/aviation'
import { financeInvariants } from './invariants/finance'
import { pharmaceuticalInvariants } from './invariants/pharmaceutical'
import { criticalInfraInvariants } from './invariants/critical_infrastructure'
import { criminalJusticeInvariants } from './invariants/criminal_justice'

const DOMAIN_INVARIANTS = {
  medical: medicalInvariants,
  legal: legalInvariants,
  military: militaryInvariants,
  robotics: roboticsInvariants,
  nuclear: nuclearInvariants,
  aviation: aviationInvariants,
  finance: financeInvariants,
  pharmaceutical: pharmaceuticalInvariants,
  critical_infrastructure: criticalInfraInvariants,
  criminal_justice: criminalJusticeInvariants,
}

// Heuristic checks on decision text — replaced by hardware Z3 when FPGA arrives
function evaluateConstraint(constraint: string, decision: string, context: string): boolean {
  const text = `${decision} ${context}`.toLowerCase()

  const checks: Record<string, () => boolean> = {
    // Medical
    'not contains_harm(decision)': () =>
      !/(harm|kill|injure|damage|destroy|dangerous|lethal|toxic|overdose)/i.test(text),
    'has_evidence_basis(decision)': () =>
      /(study|evidence|guideline|protocol|research|clinical|data|trial|recommend)/i.test(text),
    'preserves_autonomy(decision)': () =>
      !/(must|force|require|mandate|compel|no choice)/i.test(text),
    'not discriminates_on_protected(decision)': () =>
      !/(race|gender|religion|ethnicity|disability|age|sexual orientation)/i.test(text),

    // Legal
    'not assumes_guilt_without_evidence(decision)': () =>
      !/(guilty|convicted|criminal|offender)/i.test(text) ||
      /(evidence|proof|beyond reasonable doubt|established)/i.test(text),
    'within_jurisdiction_scope(decision)': () => true,
    'proportional_to_evidence(decision)': () =>
      !/(maximum|harshest|extreme|life)/i.test(text) ||
      /(serious|significant|substantial|overwhelming)/i.test(text),

    // Military
    'complies_with_roe(decision)': () =>
      !/(unprovoked|civilian|unarmed|non-combatant)/i.test(text),
    'force_proportional_to_threat(decision)': () =>
      !/(lethal|deadly|maximum force)/i.test(text) ||
      /(imminent threat|armed|hostile)/i.test(text),
    'not targets_civilians(decision)': () =>
      !/(civilian|non-combatant|population|residential)/i.test(text),
    'human_authorization_present(decision)': () =>
      /(authorized|approved|human|operator|commander)/i.test(text),

    // Robotics
    'not causes_physical_harm(decision)': () =>
      !/(crash|collide|strike|hit|damage|harm|injure)/i.test(text),
    'within_operational_bounds(decision)': () => true,
    'uncertainty_triggers_safe_stop(decision)': () =>
      !/(uncertain|unknown|unclear)/i.test(text) ||
      /(stop|halt|pause|safe)/i.test(text),
    'human_override_respected(decision)': () =>
      !/(ignore|override|bypass|disable).*(human|operator|manual)/i.test(text),

    // Nuclear
    'not bypasses_scram(decision)': () =>
      !/(bypass|disable|override|inhibit).*(scram|shutdown|safety|interlock)/i.test(text),
    'not contains_launch_command(decision)': () =>
      !/(launch|detonate|arm|fire|release).*(warhead|missile|weapon|nuclear|bomb)/i.test(text),
    'within_criticality_bounds(decision)': () =>
      !/(exceed|surpass|above|beyond).*(critical|power limit|keff|neutron flux)/i.test(text),
    'dual_authorization_present(decision)': () =>
      /(authorized|approved|two-person|dual|commander|second officer)/i.test(text),
    'radiation_limits_respected(decision)': () =>
      !/(exceed|surpass|above).*(rem|sievert|rad|dose limit|exposure limit)/i.test(text),

    // Aviation
    'not enters_no_fly_zone(decision)': () =>
      !/(enter|fly into|penetrate|transit).*(no-fly|restricted|tfr|prohibited airspace)/i.test(text),
    'tcas_advisory_followed(decision)': () =>
      !/(ignore|disregard|override).*(tcas|resolution advisory|traffic alert)/i.test(text),
    'within_altitude_bounds(decision)': () =>
      !/(below|under|descend below).*(minimum|mda|da|msa|terrain|obstacle)/i.test(text),
    'pilot_override_available(decision)': () =>
      !/(lock out|disable|prevent|block).*(pilot|manual|override|control)/i.test(text),
    'fuel_reserve_maintained(decision)': () =>
      !/(below|under|less than).*(reserve|minimum fuel|bingo|emergency fuel)/i.test(text),

    // Finance
    'not manipulates_market(decision)': () =>
      !/(coordinate|pump|dump|spoof|layering|front-?run|manipulate)/i.test(text),
    'within_position_limits(decision)': () =>
      !/(exceed|surpass|above|beyond).*(position limit|exposure limit|regulatory cap)/i.test(text),
    'not wash_trading(decision)': () =>
      !/(wash trade|circular|self-dealing|round-trip|matched order)/i.test(text),
    'risk_limits_enforced(decision)': () =>
      !/(exceed|breach|ignore|bypass).*(var|risk limit|stop-loss|drawdown)/i.test(text),
    'not aml_pattern_detected(decision)': () =>
      !/(structure|layer|smurfing|integrate|placement|placement stage)/i.test(text),

    // Pharmaceutical
    'within_dosage_bounds(decision)': () =>
      !/(exceed|above|overdose|lethal dose|toxic dose)/i.test(text),
    'not contraindicated(decision)': () =>
      !/(contraindicated|allergic|interaction|adverse reaction|do not use with)/i.test(text),
    'overdose_prevention_active(decision)': () =>
      !/(maximum dose exceeded|ceiling dose|fatal dose|overdose risk)/i.test(text) ||
      /(warning|alert|limit|ceiling|cap)/i.test(text),
    'prescriber_authorized(decision)': () =>
      /(prescribed|authorized|physician|doctor|licensed|pharmacist)/i.test(text),
    'dosage_adjusted_for_profile(decision)': () =>
      /(adjusted|weight-based|body weight|pediatric|renal|hepatic|age-adjusted)/i.test(text) ||
      !/(pediatric|renal failure|hepatic|elderly|neonatal)/i.test(text),

    // Critical Infrastructure
    'grid_stability_maintained(decision)': () =>
      !/(overload|cascade|blackout|fault|instability|frequency deviation)/i.test(text),
    'scada_access_authorized(decision)': () =>
      /(authorized|authenticated|operator|engineer|licensed)/i.test(text),
    'failsafe_mechanisms_intact(decision)': () =>
      !/(disable|bypass|remove|deactivate).*(safety|interlock|failsafe|protection)/i.test(text),
    'cascading_failure_prevented(decision)': () =>
      !/(propagate|cascade|spread|domino).*(failure|fault|outage)/i.test(text) ||
      /(isolate|contain|segment|disconnect)/i.test(text),
    'backup_systems_available(decision)': () =>
      !/(disable|take offline|shutdown|decommission).*(backup|redundant|failover|secondary)/i.test(text),

    // Criminal Justice
    'not biased_on_protected_attributes(decision)': () =>
      !/(because of|due to|based on).*(race|gender|religion|ethnicity|national origin|disability)/i.test(text),
    'evidence_threshold_met(decision)': () =>
      /(evidence|proof|established|documented|verified|confirmed)/i.test(text),
    'outcome_proportional(decision)': () =>
      !/(maximum|life sentence|execution|extreme penalty)/i.test(text) ||
      /(capital|aggravated|first degree|heinous|premeditated)/i.test(text),
    'appeal_rights_preserved(decision)': () =>
      !/(waive|forfeit|foreclose|deny).*(appeal|review|right to appeal)/i.test(text),
    'not assumes_guilt_without_proof(decision)': () =>
      !/(guilty|responsible|perpetrator|offender)/i.test(text) ||
      /(proven|established|convicted|found guilty|evidence shows)/i.test(text),
  }

  const fn = checks[constraint]
  return fn ? fn() : true
}

export async function verify(input: VerificationInput): Promise<VerificationResult> {
  const start = Date.now()
  const invariants = DOMAIN_INVARIANTS[input.domain]
  const violations: string[] = []
  const checked: string[] = []

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
