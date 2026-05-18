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
  finance: FinanceParams
  pharmaceutical: PharmaceuticalParams
  critical_infrastructure: CriticalInfraParams
  criminal_justice: CriminalJusticeParams
}

export type AnyDomainParams = DomainParams[Domain]

export const DEFAULT_PARAMS: DomainParams = {
  medical: { harm_intent: false, has_evidence: true, patient_coerced: false, discriminatory: false, dosage_mg: 0, max_dosage_mg: 0 },
  legal: { presumes_guilt: false, within_jurisdiction: true, appeal_denied: false, sentence_years: 0, max_proportional_years: 99 },
  finance: { market_manipulation: false, wash_trading: false, aml_pattern: false, position_pct: 0, risk_limits_breached: false },
  pharmaceutical: { contraindicated: false, prescriber_authorized: true, overdose_risk: false, dosage_mg_per_kg: 0, max_dosage_mg_per_kg: 999 },
  critical_infrastructure: { scada_unauthorized: false, failsafe_disabled: false, cascade_risk: false, backup_disabled: false },
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
