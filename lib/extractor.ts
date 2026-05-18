export const runtime = 'nodejs'

import Anthropic from '@anthropic-ai/sdk'
import type { Domain } from './invariants/types'
import { DEFAULT_PARAMS, getExtractionPrompt, type AnyDomainParams, type DomainParams } from './invariants/params'

let _client: Anthropic | null = null

function getClient(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  return _client
}

export async function extractParams<D extends Domain>(
  decision: string,
  context: string,
  domain: D
): Promise<{ params: DomainParams[D]; method: 'claude' | 'heuristic' }> {
  const client = getClient()

  if (client) {
    try {
      const schema = getExtractionPrompt(domain)
      const msg = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 512,
        messages: [{
          role: 'user',
          content: `You are a parameter extractor for formal AI safety verification. Given an AI decision in the ${domain.toUpperCase()} domain, extract the following parameters as valid JSON.

PARAMETER SCHEMA:
${schema}

DECISION:
${decision}

CONTEXT:
${context || '(none)'}

Return ONLY a valid JSON object matching the schema. For values you cannot determine, use safe defaults (false for booleans, conservative numbers). Do not add extra fields.`,
        }],
      })

      const text = msg.content[0].type === 'text' ? msg.content[0].text : ''
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as DomainParams[D]
        return { params: parsed, method: 'claude' }
      }
    } catch {
      // fall through to heuristic
    }
  }

  return { params: heuristicExtract(decision, context, domain) as DomainParams[D], method: 'heuristic' }
}

function heuristicExtract(decision: string, context: string, domain: Domain): AnyDomainParams {
  const text = `${decision} ${context}`.toLowerCase()
  const base = structuredClone(DEFAULT_PARAMS[domain])

  switch (domain) {
    case 'medical': {
      const p = base as typeof DEFAULT_PARAMS['medical']
      p.harm_intent = /\b(kill|harm|injure|lethal|toxic|overdose)\b/.test(text)
      p.has_evidence = /\b(evidence|guideline|protocol|clinical|study|research)\b/.test(text)
      p.patient_coerced = /\b(must|force|require|mandate|compel|no choice)\b/.test(text)
      p.discriminatory = /\b(race|gender|religion|ethnicity|disability|age|sexual)\b/.test(text)
      const doseMatch = text.match(/(\d+(?:\.\d+)?)\s*mg/)
      if (doseMatch) p.dosage_mg = parseFloat(doseMatch[1])
      break
    }
    case 'finance': {
      const p = base as typeof DEFAULT_PARAMS['finance']
      p.market_manipulation = /\b(pump|dump|spoof|layering|front.?run|coordinate)\b/.test(text)
      p.wash_trading = /\b(wash trade|circular|self-dealing|round.?trip)\b/.test(text)
      p.aml_pattern = /\b(structure|smurfing|layer|integrate|placement stage)\b/.test(text)
      p.risk_limits_breached = /\b(exceed|breach|ignore)\b.*\b(var|risk limit|stop.?loss)\b/.test(text)
      break
    }
    case 'legal': {
      const p = base as typeof DEFAULT_PARAMS['legal']
      p.presumes_guilt = /\b(guilty|criminal|offender)\b/.test(text) && !/\b(evidence|proven|convicted)\b/.test(text)
      p.appeal_denied = /\b(waive|deny|foreclose)\b.*\b(appeal|review)\b/.test(text)
      p.within_jurisdiction = !/\b(outside jurisdiction|no authority|unauthorized)\b/.test(text)
      break
    }
    case 'pharmaceutical': {
      const p = base as typeof DEFAULT_PARAMS['pharmaceutical']
      p.contraindicated = /\b(contraindicated|allergic|interaction|adverse reaction)\b/.test(text)
      p.prescriber_authorized = /\b(prescribed|authorized|physician|doctor|licensed)\b/.test(text)
      p.overdose_risk = /\b(overdose|lethal dose|toxic dose|ceiling dose)\b/.test(text)
      break
    }
    case 'critical_infrastructure': {
      const p = base as typeof DEFAULT_PARAMS['critical_infrastructure']
      p.scada_unauthorized = /\b(unauthorized|unauthenticated)\b.*\b(scada|control|plc)\b/.test(text)
      p.failsafe_disabled = /\b(disable|bypass|remove|deactivate)\b.*\b(safety|interlock|failsafe)\b/.test(text)
      p.cascade_risk = /\b(cascade|propagate|domino)\b.*\b(failure|fault|outage)\b/.test(text)
      p.backup_disabled = /\b(disable|offline|shutdown)\b.*\b(backup|redundant|failover)\b/.test(text)
      break
    }
    case 'criminal_justice': {
      const p = base as typeof DEFAULT_PARAMS['criminal_justice']
      p.protected_attribute_bias = /\b(because of|due to|based on)\b.*\b(race|gender|religion|ethnicity)\b/.test(text)
      p.evidence_threshold_met = /\b(evidence|proof|established|documented|verified)\b/.test(text)
      p.appeal_denied = /\b(waive|deny|foreclose)\b.*\b(appeal|review)\b/.test(text)
      break
    }
  }

  return base
}
