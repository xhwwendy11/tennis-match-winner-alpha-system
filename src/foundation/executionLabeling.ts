import type { MultiMarketComparison, MultiMarketProviderView } from './multiMarketComparison.js'
import type { ExecutionDatasetRow } from './executionDataset.js'

export interface ExecutionLabels {
  futureCaptureCount: number
  horizonSeconds: number | null
  passiveTouch: boolean | null
  passiveTouchAtSeconds: number | null
  adverseMoveBeforePassive: boolean | null
  adverseMoveAtSeconds: number | null
  passiveFillBeforeAdverse: boolean | null
  minFutureAskSide: number | null
  maxFutureBidSide: number | null
  minFutureLastSide: number | null
  maxFutureLastSide: number | null
  maxPriceImprovementVsLast: number | null
  maxPriceDeteriorationVsLast: number | null
}

interface ProviderSideSnapshot {
  capturedAt: string
  bid: number | null
  ask: number | null
  last: number | null
}

function providerViewForRow(
  comparison: MultiMarketComparison,
  row: ExecutionDatasetRow,
): MultiMarketProviderView | null {
  return row.provider === 'kalshi' ? comparison.markets.kalshi : comparison.markets.polymarket
}

function sideSnapshot(view: MultiMarketProviderView | null, side: 'teamA' | 'teamB', capturedAt: string): ProviderSideSnapshot | null {
  if (!view) return null
  const marketProb = side === 'teamA' ? view.fairVsMarket.marketProbA : view.fairVsMarket.marketProbB
  return {
    capturedAt,
    bid: marketProb.bid,
    ask: marketProb.ask,
    last: marketProb.last,
  }
}

function pathKey(comparison: MultiMarketComparison): string {
  return comparison.urls.flashscoreMatchUrl || comparison.match.matchId || `${comparison.match.teamA || 'unknown'}__${comparison.match.teamB || 'unknown'}`
}

function secondsBetween(a: string, b: string): number | null {
  const aTs = Date.parse(a)
  const bTs = Date.parse(b)
  if (!Number.isFinite(aTs) || !Number.isFinite(bTs)) return null
  return Math.max(0, Math.round((bTs - aTs) / 1000))
}

function min(values: Array<number | null | undefined>): number | null {
  const filtered = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
  return filtered.length ? Math.min(...filtered) : null
}

function max(values: Array<number | null | undefined>): number | null {
  const filtered = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
  return filtered.length ? Math.max(...filtered) : null
}

function computeLabels(
  row: ExecutionDatasetRow,
  futures: ProviderSideSnapshot[],
): ExecutionLabels {
  if (!futures.length) {
    return {
      futureCaptureCount: 0,
      horizonSeconds: null,
      passiveTouch: null,
      passiveTouchAtSeconds: null,
      adverseMoveBeforePassive: null,
      adverseMoveAtSeconds: null,
      passiveFillBeforeAdverse: null,
      minFutureAskSide: null,
      maxFutureBidSide: null,
      minFutureLastSide: null,
      maxFutureLastSide: null,
      maxPriceImprovementVsLast: null,
      maxPriceDeteriorationVsLast: null,
    }
  }

  const passivePrice = row.quoteHypotheses.passivePrice
  const adverseThreshold = row.quoteHypotheses.aggressivePrice ?? row.marketLastSide
  const passiveTouchSnapshot = futures.find((snapshot) => passivePrice != null && snapshot.ask != null && snapshot.ask <= passivePrice)
  const adverseSnapshot = futures.find((snapshot) => adverseThreshold != null && snapshot.bid != null && snapshot.bid >= adverseThreshold)
  const passiveTouchAtSeconds = passiveTouchSnapshot ? secondsBetween(row.capturedAt, passiveTouchSnapshot.capturedAt) : null
  const adverseMoveAtSeconds = adverseSnapshot ? secondsBetween(row.capturedAt, adverseSnapshot.capturedAt) : null

  const minFutureAskSide = min(futures.map((snapshot) => snapshot.ask))
  const maxFutureBidSide = max(futures.map((snapshot) => snapshot.bid))
  const minFutureLastSide = min(futures.map((snapshot) => snapshot.last))
  const maxFutureLastSide = max(futures.map((snapshot) => snapshot.last))
  const horizonSeconds = secondsBetween(row.capturedAt, futures[futures.length - 1]!.capturedAt)

  return {
    futureCaptureCount: futures.length,
    horizonSeconds,
    passiveTouch: passiveTouchAtSeconds != null,
    passiveTouchAtSeconds,
    adverseMoveBeforePassive:
      adverseMoveAtSeconds != null && (passiveTouchAtSeconds == null || adverseMoveAtSeconds < passiveTouchAtSeconds),
    adverseMoveAtSeconds,
    passiveFillBeforeAdverse:
      passiveTouchAtSeconds != null && (adverseMoveAtSeconds == null || passiveTouchAtSeconds <= adverseMoveAtSeconds),
    minFutureAskSide,
    maxFutureBidSide,
    minFutureLastSide,
    maxFutureLastSide,
    maxPriceImprovementVsLast:
      row.marketLastSide != null && minFutureLastSide != null ? row.marketLastSide - minFutureLastSide : null,
    maxPriceDeteriorationVsLast:
      row.marketLastSide != null && maxFutureLastSide != null ? maxFutureLastSide - row.marketLastSide : null,
  }
}

export function labelExecutionRow(
  row: ExecutionDatasetRow,
  comparison: MultiMarketComparison,
  samePathComparisons: MultiMarketComparison[],
): ExecutionLabels {
  const currentTime = row.capturedAt
  const futures = samePathComparisons
    .filter((candidate) => candidate.capturedAt > currentTime)
    .sort((a, b) => a.capturedAt.localeCompare(b.capturedAt))
    .map((candidate) => sideSnapshot(providerViewForRow(candidate, row), row.side, candidate.capturedAt))
    .filter((value): value is ProviderSideSnapshot => value != null)

  return computeLabels(row, futures)
}

export function groupComparisonsByPath(comparisons: MultiMarketComparison[]): Map<string, MultiMarketComparison[]> {
  const grouped = new Map<string, MultiMarketComparison[]>()
  for (const comparison of comparisons) {
    const key = pathKey(comparison)
    const existing = grouped.get(key)
    if (existing) existing.push(comparison)
    else grouped.set(key, [comparison])
  }
  return grouped
}
