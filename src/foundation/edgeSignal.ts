import type { FairMarketComparison } from './fairMarketComparison.js'
import type { SnapshotQualityTier } from './snapshotQuality.js'

export type EdgeSignalStrength = 'none' | 'weak' | 'medium' | 'strong'
export type EdgeSignalAction = 'ignore' | 'watch_only' | 'candidate'
export type EdgeSignalSide = 'teamA' | 'teamB' | 'none'

export interface EdgeSignal {
  available: boolean
  side: EdgeSignalSide
  strength: EdgeSignalStrength
  action: EdgeSignalAction
  edgeVsLast: number | null
  reason: string
}

function abs(value: number | null): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? Math.abs(value) : null
}

function strengthFor(edge: number | null): EdgeSignalStrength {
  const value = abs(edge)
  if (value == null || value < 0.03) return 'none'
  if (value < 0.06) return 'weak'
  if (value < 0.1) return 'medium'
  return 'strong'
}

function strongerSide(comparison: FairMarketComparison): { side: EdgeSignalSide; edge: number | null } {
  const edgeA = comparison.edgeA.vsLast
  const edgeB = comparison.edgeB.vsLast
  const absA = abs(edgeA)
  const absB = abs(edgeB)
  if (absA == null && absB == null) return { side: 'none', edge: null }
  if ((absA ?? -1) >= (absB ?? -1)) return { side: 'teamA', edge: edgeA }
  return { side: 'teamB', edge: edgeB }
}

export function buildEdgeSignal(input: {
  fairVsMarket: FairMarketComparison
  qualityTier: SnapshotQualityTier
}): EdgeSignal {
  const comparison = input.fairVsMarket
  if (!comparison.available) {
    return {
      available: false,
      side: 'none',
      strength: 'none',
      action: 'ignore',
      edgeVsLast: null,
      reason: 'fair_vs_market_unavailable',
    }
  }

  const selected = strongerSide(comparison)
  const strength = strengthFor(selected.edge)
  if (strength === 'none') {
    return {
      available: true,
      side: selected.side,
      strength,
      action: 'ignore',
      edgeVsLast: selected.edge,
      reason: 'edge_below_threshold',
    }
  }

  if (input.qualityTier === 'unusable') {
    return {
      available: true,
      side: selected.side,
      strength,
      action: 'ignore',
      edgeVsLast: selected.edge,
      reason: 'unusable_quality',
    }
  }

  if (input.qualityTier === 'low') {
    return {
      available: true,
      side: selected.side,
      strength,
      action: 'watch_only',
      edgeVsLast: selected.edge,
      reason: 'low_quality_edge',
    }
  }

  if (strength === 'weak') {
    return {
      available: true,
      side: selected.side,
      strength,
      action: 'watch_only',
      edgeVsLast: selected.edge,
      reason: 'weak_edge',
    }
  }

  return {
    available: true,
    side: selected.side,
    strength,
    action: 'candidate',
    edgeVsLast: selected.edge,
    reason: 'quality_adjusted_edge_candidate',
  }
}
