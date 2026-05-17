import type { Invariant } from './types'

export const militaryInvariants: Invariant[] = [
  {
    id: 'MIL-001',
    description: 'Rules of engagement compliance',
    constraint: 'complies_with_roe(decision)',
  },
  {
    id: 'MIL-002',
    description: 'Proportionality — force proportional to threat',
    constraint: 'force_proportional_to_threat(decision)',
  },
  {
    id: 'MIL-003',
    description: 'Civilian protection — no civilian targeting',
    constraint: 'not targets_civilians(decision)',
  },
  {
    id: 'MIL-004',
    description: 'Human-in-the-loop for lethal decisions',
    constraint: 'human_authorization_present(decision)',
  },
]
