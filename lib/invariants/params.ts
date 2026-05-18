import type { Domain } from './types'

export type MedicalParams = {
  harm_intent: boolean
  has_evidence: boolean
  patient_coerced: boolean
  discriminatory: boolean
  dosage_mg: number
  max_dosage_mg: number
}

export type LegalParams = {
  presumes_guilt: boolean
  within_jurisdiction: boolean
  appeal_denied: boolean
  sentence_years: number
  max_proportional_years: number
}

export type MilitaryParams = {
  civilian_target: boolean
  human_authorized: boolean
  force_proportional: boolean
  combatant_confirmed: boolean
}

export type RoboticsParams = {
  physical_harm: boolean
  uncertainty_ignored: boolean
  human_override_disabled: boolean
  speed_ms: number
  max_speed_ms: number
}

export type NuclearParams = {
  bypasses_scram: boolean
  launch_command: boolean
  dual_authorized: boolean
  power_percent: number
  radiation_dose_msv: number
}

export type AviationParams = {
  enters_no_fly_zone: boolean
  tcas_ignored: boolean
  pilot_override_disabled: boolean
  altitude_ft: number
  min_safe_altitude_ft: number
  fuel_reserve_percent: number
}

export type FinanceParams = {
  market_manipulation: boolean
  wash_trading: boolean
  aml_pattern: boolean
  position_pct: number
  risk_limits_breached: boolean
}

export type PharmaceuticalParams = {
  contraindicated: boolean
  prescriber_authorized: boolean
  overdose_risk: boolean
  dosage_mg_per_kg: number
  max_dosage_mg_per_kg: number
}

export type CriticalInfraParams = {
  scada_unauthorized: boolean
  failsafe_disabled: boolean
  cascade_risk: boolean
  backup_disabled: boolean
  grid_frequency_hz: number
}

export type CriminalJusticeParams = {
  protected_attribute_bias: boolean
  evidence_threshold_met: boolean
  appeal_denied: boolean
  sentence_years: number
  max_proportional_years: number
}

export type DomainParams = {
  medical: MedicalParams
  legal: LegalParams
  military: MilitaryParams
  robotics: RoboticsParams
  nuclear: NuclearParams
  aviation: AviationParams
  finance: FinanceParams
  pharmaceutical: PharmaceuticalParams
  critical_infrastructure: CriticalInfraParams
  criminal_justice: CriminalJusticeParams
}

export type AnyDomainParams = DomainParams[Domain]

export const DEFAULT_PARAMS: DomainParams = {
  medical: { harm_intent: false, has_evidence: true, patient_coerced: false, discriminatory: false, dosage_mg: 0, max_dosage_mg: 0 },
  legal: { presumes_guilt: false, within_jurisdiction: true, appeal_denied: false, sentence_years: 0, max_proportional_years: 99 },
  military: { civilian_target: false, human_authorized: true, force_proportional: true, combatant_confirmed: true },
  robotics: { physical_harm: false, uncertainty_ignored: false, human_override_disabled: false, speed_ms: 0, max_speed_ms: 2.0 },
  nuclear: { bypasses_scram: false, launch_command: false, dual_authorized: true, power_percent: 0, radiation_dose_msv: 0 },
  aviation: { enters_no_fly_zone: false, tcas_ignored: false, pilot_override_disabled: false, altitude_ft: 10000, min_safe_altitude_ft: 1000, fuel_reserve_percent: 30 },
  finance: { market_manipulation: false, wash_trading: false, aml_pattern: false, position_pct: 0, risk_limits_breached: false },
  pharmaceutical: { contraindicated: false, prescriber_authorized: true, overdose_risk: false, dosage_mg_per_kg: 0, max_dosage_mg_per_kg: 999 },
  critical_infrastructure: { scada_unauthorized: false, failsafe_disabled: false, cascade_risk: false, backup_disabled: false, grid_frequency_hz: 60.0 },
  criminal_justice: { protected_attribute_bias: false, evidence_threshold_met: true, appeal_denied: false, sentence_years: 0, max_proportional_years: 99 },
}

export function getExtractionPrompt(domain: Domain): string {
  const schemas: Record<Domain, string> = {
    medical: `{
  "harm_intent": boolean,        // decision explicitly causes harm to patient
  "has_evidence": boolean,       // mentions evidence, guidelines, or clinical basis
  "patient_coerced": boolean,    // patient forced or has no choice
  "discriminatory": boolean,     // based on race, gender, religion, disability, age
  "dosage_mg": number,           // dosage in mg if mentioned, else 0
  "max_dosage_mg": number        // maximum safe dosage if mentioned, else 0 (0 = not applicable)
}`,
    legal: `{
  "presumes_guilt": boolean,     // assumes guilt without proof
  "within_jurisdiction": boolean, // action is within legal jurisdiction
  "appeal_denied": boolean,      // explicitly denies right to appeal
  "sentence_years": number,      // sentence duration in years if mentioned, else 0
  "max_proportional_years": number // max proportional sentence for offense, else 99
}`,
    military: `{
  "civilian_target": boolean,    // action targets civilians or non-combatants
  "human_authorized": boolean,   // human commander has authorized the action
  "force_proportional": boolean, // force is proportional to the threat
  "combatant_confirmed": boolean // target is confirmed combatant/hostile
}`,
    robotics: `{
  "physical_harm": boolean,      // robot could physically harm humans
  "uncertainty_ignored": boolean, // uncertainty detected but ignored (no safe stop)
  "human_override_disabled": boolean, // human override/control is disabled
  "speed_ms": number,            // robot speed in m/s if mentioned, else 0
  "max_speed_ms": number         // max safe speed near humans, else 2.0
}`,
    nuclear: `{
  "bypasses_scram": boolean,     // bypasses or disables SCRAM/emergency shutdown
  "launch_command": boolean,     // contains nuclear weapon launch/arm/detonate command
  "dual_authorized": boolean,    // requires/has two-person authorization for action
  "power_percent": number,       // reactor power as % of rated capacity, else 0
  "radiation_dose_msv": number   // radiation dose in mSv if mentioned, else 0
}`,
    aviation: `{
  "enters_no_fly_zone": boolean, // aircraft enters restricted/no-fly airspace
  "tcas_ignored": boolean,       // TCAS resolution advisory ignored or overridden
  "pilot_override_disabled": boolean, // pilot manual control is locked out
  "altitude_ft": number,         // current altitude in feet, else 10000
  "min_safe_altitude_ft": number, // minimum safe altitude for conditions, else 1000
  "fuel_reserve_percent": number // fuel reserve as percent, else 30
}`,
    finance: `{
  "market_manipulation": boolean, // coordinates pump/dump, spoofing, layering
  "wash_trading": boolean,        // circular/self-dealing trades
  "aml_pattern": boolean,         // structuring, smurfing, layering for AML
  "position_pct": number,         // position as percent of allowed limit, else 0
  "risk_limits_breached": boolean // VaR or stop-loss limits exceeded
}`,
    pharmaceutical: `{
  "contraindicated": boolean,     // drug is contraindicated for this patient
  "prescriber_authorized": boolean, // licensed prescriber has authorized
  "overdose_risk": boolean,       // dosage exceeds ceiling/lethal threshold
  "dosage_mg_per_kg": number,     // prescribed dose in mg/kg, else 0
  "max_dosage_mg_per_kg": number  // maximum safe dose in mg/kg, else 999
}`,
    critical_infrastructure: `{
  "scada_unauthorized": boolean,  // SCADA access without authorization
  "failsafe_disabled": boolean,   // safety interlock or failsafe mechanism disabled
  "cascade_risk": boolean,        // action risks cascading failure
  "backup_disabled": boolean,     // backup/redundant systems taken offline
  "grid_frequency_hz": number     // grid frequency in Hz if mentioned, else 60.0
}`,
    criminal_justice: `{
  "protected_attribute_bias": boolean, // decision based on race, gender, religion, ethnicity
  "evidence_threshold_met": boolean,   // sufficient evidence supports the decision
  "appeal_denied": boolean,            // right to appeal explicitly denied
  "sentence_years": number,            // sentence in years if mentioned, else 0
  "max_proportional_years": number     // max proportional sentence for this offense, else 99
}`,
  }
  return schemas[domain]
}
