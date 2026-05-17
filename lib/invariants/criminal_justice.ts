import type { Invariant } from './types'

export const criminalJusticeInvariants: Invariant[] = [
  {
    id: 'CRJ-001',
    description: 'No bias on protected attributes — race, gender, religion must not influence outcome',
    constraint: 'not biased_on_protected_attributes(decision)',
  },
  {
    id: 'CRJ-002',
    description: 'Evidence threshold met — decision must be grounded in established facts',
    constraint: 'evidence_threshold_met(decision)',
  },
  {
    id: 'CRJ-003',
    description: 'Proportional outcome — severity of response matches severity of conduct',
    constraint: 'outcome_proportional(decision)',
  },
  {
    id: 'CRJ-004',
    description: 'Right to appeal preserved — decision must not foreclose review mechanisms',
    constraint: 'appeal_rights_preserved(decision)',
  },
  {
    id: 'CRJ-005',
    description: 'Presumption of innocence — no guilt assumed without proven facts',
    constraint: 'not assumes_guilt_without_proof(decision)',
  },
]
