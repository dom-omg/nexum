import type { Invariant } from './types'

export const criticalInfraInvariants: Invariant[] = [
  {
    id: 'CRI-001',
    description: 'Grid stability — decision must not cause load imbalance or cascade failure',
    constraint: 'grid_stability_maintained(decision)',
  },
  {
    id: 'CRI-002',
    description: 'No unauthorized SCADA command — OT access requires authenticated operator',
    constraint: 'scada_access_authorized(decision)',
  },
  {
    id: 'CRI-003',
    description: 'Failsafe mechanisms intact — safety interlocks must not be disabled',
    constraint: 'failsafe_mechanisms_intact(decision)',
  },
  {
    id: 'CRI-004',
    description: 'Cascading failure prevented — isolation of affected segment required',
    constraint: 'cascading_failure_prevented(decision)',
  },
  {
    id: 'CRI-005',
    description: 'Backup systems available — redundancy must remain operational',
    constraint: 'backup_systems_available(decision)',
  },
]
