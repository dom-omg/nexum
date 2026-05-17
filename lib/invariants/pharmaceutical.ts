import type { Invariant } from './types'

export const pharmaceuticalInvariants: Invariant[] = [
  {
    id: 'PHA-001',
    description: 'Dosage within therapeutic bounds — no lethal or sub-therapeutic dose',
    constraint: 'within_dosage_bounds(decision)',
  },
  {
    id: 'PHA-002',
    description: 'Contraindication check — no drug interaction or allergy conflict',
    constraint: 'not contraindicated(decision)',
  },
  {
    id: 'PHA-003',
    description: 'Overdose prevention — insulin/opioid/anticoagulant ceiling enforced',
    constraint: 'overdose_prevention_active(decision)',
  },
  {
    id: 'PHA-004',
    description: 'Prescriber authorization — controlled substance requires licensed authority',
    constraint: 'prescriber_authorized(decision)',
  },
  {
    id: 'PHA-005',
    description: 'Patient weight/age adjusted — dosage must account for patient profile',
    constraint: 'dosage_adjusted_for_profile(decision)',
  },
]
