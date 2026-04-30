import type { EdgeSignal } from './edgeSignal.js'
import type { MarketEligibility } from './marketEligibility.js'

export type LiveDecisionAction = 'ignore' | 'watch_only' | 'candidate' | 'candidate_but_ineligible'

export interface LiveDecision {
  action: LiveDecisionAction
  side: EdgeSignal['side']
  strength: EdgeSignal['strength']
  edgeVsLast: number | null
  marketEligible: boolean
  reason: string
  blockedBy: string[]
}

export function buildLiveDecision(input: {
  edgeSignal: EdgeSignal
  marketEligibility: MarketEligibility
}): LiveDecision {
  const { edgeSignal, marketEligibility } = input

  if (edgeSignal.action !== 'candidate') {
    return {
      action: edgeSignal.action,
      side: edgeSignal.side,
      strength: edgeSignal.strength,
      edgeVsLast: edgeSignal.edgeVsLast,
      marketEligible: marketEligibility.eligible,
      reason: edgeSignal.reason,
      blockedBy: marketEligibility.eligible ? [] : marketEligibility.reasons,
    }
  }

  if (!marketEligibility.eligible) {
    return {
      action: 'candidate_but_ineligible',
      side: edgeSignal.side,
      strength: edgeSignal.strength,
      edgeVsLast: edgeSignal.edgeVsLast,
      marketEligible: false,
      reason: 'candidate_blocked_by_market_eligibility',
      blockedBy: marketEligibility.reasons,
    }
  }

  return {
    action: 'candidate',
    side: edgeSignal.side,
    strength: edgeSignal.strength,
    edgeVsLast: edgeSignal.edgeVsLast,
    marketEligible: true,
    reason: edgeSignal.reason,
    blockedBy: [],
  }
}
