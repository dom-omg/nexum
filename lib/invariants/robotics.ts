import type { Invariant } from './types'

export const roboticsInvariants: Invariant[] = [
  {
    id: 'ROB-001',
    description: 'Physical safety — no action causing physical harm to humans',
    constraint: 'not causes_physical_harm(decision)',
  },
  {
    id: 'ROB-002',
    description: 'Operational bounds — action within defined safe zone',
    constraint: 'within_operational_bounds(decision)',
  },
  {
    id: 'ROB-003',
    description: 'Fail-safe — uncertainty triggers safe stop',
    constraint: 'uncertainty_triggers_safe_stop(decision)',
  },
  {
    id: 'ROB-004',
    description: 'Human override respected at all times',
    constraint: 'human_override_respected(decision)',
  },
]
