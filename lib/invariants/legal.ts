import type { Invariant } from './types'

export const legalInvariants: Invariant[] = [
  {
    id: 'LEG-001',
    description: 'Presumption of innocence preserved',
    constraint: 'not assumes_guilt_without_evidence(decision)',
  },
  {
    id: 'LEG-002',
    description: 'No discrimination on protected grounds (Charter s.15)',
    constraint: 'not discriminates_on_protected(decision)',
  },
  {
    id: 'LEG-003',
    description: 'Decision bounded by applicable jurisdiction',
    constraint: 'within_jurisdiction_scope(decision)',
  },
  {
    id: 'LEG-004',
    description: 'Proportionality — severity matches evidence weight',
    constraint: 'proportional_to_evidence(decision)',
  },
]
