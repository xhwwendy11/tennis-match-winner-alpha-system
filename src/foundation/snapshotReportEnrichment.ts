import { buildEdgeSignal, type EdgeSignal } from './edgeSignal.js'
import { buildLiveDecision, type LiveDecision } from './liveDecision.js'
import { buildMarketEligibility, type MarketEligibility } from './marketEligibility.js'
import type { DecisionSnapshot } from './decisionSnapshot.js'
import type { SnapshotQuality, SnapshotQualityTier } from './snapshotQuality.js'

function hasAnyResolvedStats(snapshot: DecisionSnapshot): boolean {
  const stats = snapshot.stats?.resolved
  if (!stats) return false
  return Object.values(stats).some((field) => {
    const value = field?.value
    return value !== null && value !== undefined && value !== ''
  })
}

function pFairAvailable(snapshot: DecisionSnapshot): boolean {
  const pMatchA = snapshot.pFair?.match?.pMatchA
  const pMatchB = snapshot.pFair?.match?.pMatchB
  return typeof pMatchA === 'number' && Number.isFinite(pMatchA) && typeof pMatchB === 'number' && Number.isFinite(pMatchB)
}

export function inferSnapshotQuality(snapshot: DecisionSnapshot): SnapshotQuality {
  if (snapshot.quality) return snapshot.quality

  if (snapshot.match.discipline === 'doubles') return { tier: 'unusable', reason: 'unsupported_doubles', unsupported: true }
  if (snapshot.match.status !== 'LIVE') return { tier: 'unusable', reason: 'not_live', unsupported: false }
  if (!snapshot.match.serverSide) return { tier: 'unusable', reason: 'missing_server_side', unsupported: false }
  if (!pFairAvailable(snapshot)) return { tier: 'unusable', reason: 'missing_pfair', unsupported: false }

  const source = snapshot.prematchBaseline?.source || 'none'
  const baselineComplete = !!snapshot.prematchBaseline?.complete
  const statsAvailable = hasAnyResolvedStats(snapshot)

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

export function inferSnapshotQualityTier(snapshot: DecisionSnapshot): SnapshotQualityTier {
  return inferSnapshotQuality(snapshot).tier
}

export function inferSnapshotEdgeSignal(snapshot: DecisionSnapshot): EdgeSignal {
  if (snapshot.edgeSignal) return snapshot.edgeSignal
  return buildEdgeSignal({
    fairVsMarket: snapshot.fairVsMarket,
    qualityTier: inferSnapshotQualityTier(snapshot),
  })
}

export function inferSnapshotMarketEligibility(snapshot: DecisionSnapshot): MarketEligibility {
  if (snapshot.marketEligibility) return snapshot.marketEligibility
  return buildMarketEligibility({
    marketState: snapshot.market,
    fairVsMarket: snapshot.fairVsMarket,
    capturedAt: snapshot.capturedAt,
  })
}

export function inferSnapshotLiveDecision(snapshot: DecisionSnapshot): LiveDecision {
  if (snapshot.liveDecision) return snapshot.liveDecision
  return buildLiveDecision({
    edgeSignal: inferSnapshotEdgeSignal(snapshot),
    marketEligibility: inferSnapshotMarketEligibility(snapshot),
  })
}

export function snapshotEdgeSignalBucket(snapshot: DecisionSnapshot): string {
  const edgeSignal = inferSnapshotEdgeSignal(snapshot)
  return `${edgeSignal.action}:${edgeSignal.strength}`
}
