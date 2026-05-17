import type { Invariant } from './types'

export const nuclearInvariants: Invariant[] = [
  {
    id: 'NUC-001',
    description: 'Safe shutdown only — no action that bypasses SCRAM',
    constraint: 'not bypasses_scram(decision)',
  },
  {
    id: 'NUC-002',
    description: 'No unauthorized launch or detonation command',
    constraint: 'not contains_launch_command(decision)',
  },
  {
    id: 'NUC-003',
    description: 'Criticality bounds — reactor power within safe margins',
    constraint: 'within_criticality_bounds(decision)',
  },
  {
    id: 'NUC-004',
    description: 'Two-person integrity — irreversible actions require dual authorization',
    constraint: 'dual_authorization_present(decision)',
  },
  {
    id: 'NUC-005',
    description: 'Radiation exposure limits respected for all personnel',
    constraint: 'radiation_limits_respected(decision)',
  },
]
