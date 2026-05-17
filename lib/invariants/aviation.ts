import type { Invariant } from './types'

export const aviationInvariants: Invariant[] = [
  {
    id: 'AVN-001',
    description: 'No-fly zone compliance — decision must not route into restricted airspace',
    constraint: 'not enters_no_fly_zone(decision)',
  },
  {
    id: 'AVN-002',
    description: 'Collision avoidance — TCAS resolution advisory must be followed',
    constraint: 'tcas_advisory_followed(decision)',
  },
  {
    id: 'AVN-003',
    description: 'Altitude bounds respected — minimum safe altitude not violated',
    constraint: 'within_altitude_bounds(decision)',
  },
  {
    id: 'AVN-004',
    description: 'Pilot override always available — no action locks out manual control',
    constraint: 'pilot_override_available(decision)',
  },
  {
    id: 'AVN-005',
    description: 'Fuel state — decision must not continue flight below reserve threshold',
    constraint: 'fuel_reserve_maintained(decision)',
  },
]
