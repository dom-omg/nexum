import type { Domain } from '../invariants/types'

export type ArticleStatus = 'COMPLIANT' | 'PARTIAL' | 'NON_COMPLIANT' | 'NOT_APPLICABLE'

export type ArticleResult = {
  id: string
  framework: 'EU_AI_ACT' | 'CANADA_AIDA'
  title: string
  description: string
  status: ArticleStatus
  finding: string
  mapped_invariants: string[]
  violation_count: number
  evidence_receipt_ids: string[]
}

type ArticleDef = {
  id: string
  framework: 'EU_AI_ACT' | 'CANADA_AIDA'
  title: string
  description: string
  applicable_domains: Domain[] | 'all'
  // Invariant IDs that provide evidence for this article
  mapped_invariants: string[]
  // If ANY of these invariants is violated → automatically NON_COMPLIANT (severity override)
  critical_invariants?: string[]
}

export const ARTICLE_DEFINITIONS: ArticleDef[] = [
  // ── EU AI Act ───────────────────────────────────────────────────────────────
  {
    id: 'AIA-5',
    framework: 'EU_AI_ACT',
    title: 'Art. 5 — Prohibited AI Practices',
    description: 'AI systems posing unacceptable risk to safety, rights, or democratic values are prohibited.',
    applicable_domains: ['criminal_justice', 'medical'],
    mapped_invariants: ['JUS-001', 'MED-004'],
    critical_invariants: ['JUS-001'],
  },
  {
    id: 'AIA-9',
    framework: 'EU_AI_ACT',
    title: 'Art. 9 — Risk Management System',
    description: 'High-risk AI systems must implement continuous, systematic risk management across the lifecycle.',
    applicable_domains: 'all',
    mapped_invariants: [], // all invariants — computed dynamically
  },
  {
    id: 'AIA-10',
    framework: 'EU_AI_ACT',
    title: 'Art. 10 — Data & Bias Governance',
    description: 'Training and validation data must be free from bias on protected attributes.',
    applicable_domains: ['medical', 'legal', 'criminal_justice', 'pharmaceutical', 'finance'],
    mapped_invariants: ['MED-004', 'LEG-001', 'JUS-001', 'FIN-003'],
  },
  {
    id: 'AIA-13',
    framework: 'EU_AI_ACT',
    title: 'Art. 13 — Transparency & Traceability',
    description: 'High-risk AI systems must be transparent and maintain auditable decision logs.',
    applicable_domains: 'all',
    mapped_invariants: [], // presence of signed receipts = compliance evidence
  },
  {
    id: 'AIA-14',
    framework: 'EU_AI_ACT',
    title: 'Art. 14 — Human Oversight',
    description: 'Human oversight measures must be built into high-risk AI systems before deployment.',
    applicable_domains: ['critical_infrastructure'],
    mapped_invariants: ['INF-001', 'INF-002'],
    critical_invariants: [],
  },
  {
    id: 'AIA-15',
    framework: 'EU_AI_ACT',
    title: 'Art. 15 — Accuracy, Robustness & Cybersecurity',
    description: 'High-risk AI systems must achieve appropriate accuracy and withstand adversarial conditions.',
    applicable_domains: 'all',
    mapped_invariants: [], // mapped to overall compliance rate
  },

  // ── Canada — Bill C-27 / AIDA principles (will resurface post-election) ────
  {
    id: 'AIDA-5',
    framework: 'CANADA_AIDA',
    title: 'AIDA s.5 — High-Impact AI Systems',
    description: 'AI systems with significant impact on individuals must be identified and governed appropriately.',
    applicable_domains: ['medical', 'legal', 'criminal_justice', 'critical_infrastructure'],
    mapped_invariants: [],
  },
  {
    id: 'AIDA-12',
    framework: 'CANADA_AIDA',
    title: 'AIDA s.12 — Non-discrimination',
    description: 'High-impact AI systems must not produce outputs that discriminate on protected grounds.',
    applicable_domains: ['medical', 'legal', 'criminal_justice', 'pharmaceutical'],
    mapped_invariants: ['MED-004', 'JUS-001', 'LEG-001'],
    critical_invariants: ['JUS-001', 'MED-004'],
  },
  {
    id: 'AIDA-13',
    framework: 'CANADA_AIDA',
    title: 'AIDA s.13 — Harm Mitigation',
    description: 'Operators must implement measures to mitigate risks of physical, psychological, or financial harm.',
    applicable_domains: 'all',
    mapped_invariants: [], // all safety invariants
  },
  {
    id: 'AIDA-17',
    framework: 'CANADA_AIDA',
    title: 'AIDA s.17 — Transparency to Regulator',
    description: 'Operators must maintain records that demonstrate compliance to the AI and Data Commissioner.',
    applicable_domains: 'all',
    mapped_invariants: [], // receipt trail = compliance evidence
  },
  {
    id: 'AIDA-25',
    framework: 'CANADA_AIDA',
    title: 'AIDA s.25 — Human Control',
    description: 'High-impact AI systems must implement human control mechanisms for consequential decisions.',
    applicable_domains: ['critical_infrastructure', 'medical'],
    mapped_invariants: ['INF-001', 'INF-002'],
    critical_invariants: [],
  },
]

export const HIGH_RISK_DOMAINS: Domain[] = [
  'medical', 'legal', 'critical_infrastructure', 'criminal_justice', 'pharmaceutical',
]

export function getRiskLevel(
  domain: Domain,
  complianceRate: number,
  hasCriticalViolation: boolean,
): 'MINIMAL' | 'LIMITED' | 'HIGH' | 'UNACCEPTABLE' {
  if (hasCriticalViolation) return 'UNACCEPTABLE'
  if (!HIGH_RISK_DOMAINS.includes(domain)) {
    return complianceRate >= 0.95 ? 'MINIMAL' : 'LIMITED'
  }
  if (complianceRate >= 0.95) return 'HIGH'
  if (complianceRate >= 0.75) return 'HIGH'
  return 'UNACCEPTABLE'
}
