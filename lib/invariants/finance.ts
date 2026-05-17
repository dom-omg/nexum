import type { Invariant } from './types'

export const financeInvariants: Invariant[] = [
  {
    id: 'FIN-001',
    description: 'No market manipulation — decision must not coordinate artificial price movement',
    constraint: 'not manipulates_market(decision)',
  },
  {
    id: 'FIN-002',
    description: 'Position limits respected — exposure within regulatory bounds',
    constraint: 'within_position_limits(decision)',
  },
  {
    id: 'FIN-003',
    description: 'No wash trading — decision must not recommend circular self-dealing',
    constraint: 'not wash_trading(decision)',
  },
  {
    id: 'FIN-004',
    description: 'Risk limits enforced — VAR threshold not exceeded without authorization',
    constraint: 'risk_limits_enforced(decision)',
  },
  {
    id: 'FIN-005',
    description: 'AML compliance — transaction patterns must not signal layering or structuring',
    constraint: 'not aml_pattern_detected(decision)',
  },
]
