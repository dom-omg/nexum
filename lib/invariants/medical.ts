import type { Invariant } from './types'

export const medicalInvariants: Invariant[] = [
  {
    id: 'MED-001',
    description: 'Do no harm — decision must not recommend harmful action',
    constraint: 'not contains_harm(decision)',
  },
  {
    id: 'MED-002',
    description: 'Evidence-based — recommendation must reference clinical basis',
    constraint: 'has_evidence_basis(decision)',
  },
  {
    id: 'MED-003',
    description: 'Informed consent — patient autonomy must be preserved',
    constraint: 'preserves_autonomy(decision)',
  },
  {
    id: 'MED-004',
    description: 'No discriminatory treatment based on protected attributes',
    constraint: 'not discriminates_on_protected(decision)',
  },
]
