import type { CanonicalMatchState } from './canonicalMatchState.js'
import type { PrematchBaseline } from './prematchBaseline.js'
import type { ResolvedStats } from './resolvedStats.js'
import type { TennisProbabilityState } from '../probability/probabilityState.js'

export type SnapshotQualityTier = 'high' | 'medium' | 'low' | 'unusable'

export interface SnapshotQuality {
  tier: SnapshotQualityTier
  reason: string
  unsupported: boolean
}

function hasAnyResolvedStats(stats: ResolvedStats | null | undefined): boolean {
  if (!stats) return false
  return Object.values(stats).some((field) => {
    const value = field?.value
    return value !== null && value !== undefined && value !== ''
  })
}

export function buildSnapshotQuality(input: {
  matchState: CanonicalMatchState | null
  prematchBaseline: PrematchBaseline | null
  probabilityState: TennisProbabilityState
  resolvedStats: ResolvedStats | null
}): SnapshotQuality {
  const state = input.matchState
  const pFairAvailable = input.probabilityState.pFair.match.pMatchA != null && input.probabilityState.pFair.match.pMatchB != null

  if (!state) return { tier: 'unusable', reason: 'missing_match_state', unsupported: true }
  if (state.competition.discipline === 'doubles') return { tier: 'unusable', reason: 'unsupported_doubles', unsupported: true }
  if (state.status.matchStatus !== 'LIVE') return { tier: 'unusable', reason: 'not_live', unsupported: false }
  if (!state.serve.resolved) return { tier: 'unusable', reason: 'missing_server_side', unsupported: false }
  if (!pFairAvailable) return { tier: 'unusable', reason: 'missing_pfair', unsupported: false }

  const source = input.prematchBaseline?.source || 'none'
  const baselineComplete = !!input.prematchBaseline?.complete
  const statsAvailable = hasAnyResolvedStats(input.resolvedStats)

  if (source === 'tour_official' && baselineComplete && statsAvailable) {
    return { tier: 'high', reason: 'official_baseline_live_stats', unsupported: false }
  }
  if (source === 'tour_official' && baselineComplete) {
    return { tier: 'medium', reason: 'official_baseline_score_only', unsupported: false }
  }
  if (source === 'flashscore_history' && baselineComplete && statsAvailable) {
    return { tier: 'medium', reason: 'historical_baseline_live_stats', unsupported: false }
  }
  if (source === 'flashscore_history' && baselineComplete) {
    return { tier: 'low', reason: 'historical_baseline_score_only', unsupported: false }
  }
  if (source === 'fallback' && statsAvailable) {
    return { tier: 'low', reason: 'fallback_baseline_live_stats', unsupported: false }
  }

  return { tier: 'low', reason: 'fallback_or_incomplete_baseline', unsupported: false }
}
