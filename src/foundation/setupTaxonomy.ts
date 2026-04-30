import type { MultiMarketComparison, MultiMarketProviderView } from './multiMarketComparison.js'

export type TradeSetupType =
  | 'cross_market_teamA'
  | 'cross_market_teamB'
  | 'single_market_kalshi_teamA'
  | 'single_market_kalshi_teamB'
  | 'single_market_polymarket_teamA'
  | 'single_market_polymarket_teamB'
  | 'blocked_candidate'
  | 'watch_only_dislocation'
  | 'no_setup'

export interface TradeSetupClassification {
  type: TradeSetupType
  side: 'teamA' | 'teamB' | 'none'
  providersInvolved: Array<'kalshi' | 'polymarket'>
  primaryProvider: 'kalshi' | 'polymarket' | 'none'
  reason: string
  metrics: {
    kalshiEdgeA: number | null
    kalshiEdgeB: number | null
    polymarketEdgeA: number | null
    polymarketEdgeB: number | null
    crossSpreadA: number | null
    crossSpreadB: number | null
  }
}

function abs(value: number | null): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.abs(value) : -1
}

function edgeForSide(view: MultiMarketProviderView | null, side: 'teamA' | 'teamB'): number | null {
  if (!view) return null
  return side === 'teamA' ? view.fairVsMarket.edgeA.vsLast : view.fairVsMarket.edgeB.vsLast
}

function betterProviderForSide(
  kalshi: MultiMarketProviderView | null,
  polymarket: MultiMarketProviderView | null,
  side: 'teamA' | 'teamB',
): 'kalshi' | 'polymarket' | 'none' {
  const kalshiEdge = edgeForSide(kalshi, side)
  const polymarketEdge = edgeForSide(polymarket, side)
  if (abs(kalshiEdge) < 0 && abs(polymarketEdge) < 0) return 'none'
  return abs(kalshiEdge) >= abs(polymarketEdge) ? 'kalshi' : 'polymarket'
}

function isDirectCandidate(view: MultiMarketProviderView | null): boolean {
  return view?.liveDecision.action === 'candidate'
}

function isBlockedCandidate(view: MultiMarketProviderView | null): boolean {
  return view?.liveDecision.action === 'candidate_but_ineligible'
}

function isWatchOnly(view: MultiMarketProviderView | null): boolean {
  return view?.liveDecision.action === 'watch_only'
}

export const DEFAULT_CROSS_MARKET_SPREAD_THRESHOLD = 0.06
export const DEFAULT_DIRECT_EDGE_THRESHOLD = 0.06

export function classifyTradeSetup(
  comparison: MultiMarketComparison,
  options: {
    crossMarketSpreadThreshold?: number
    directEdgeThreshold?: number
  } = {},
): TradeSetupClassification {
  const crossMarketSpreadThreshold = options.crossMarketSpreadThreshold ?? DEFAULT_CROSS_MARKET_SPREAD_THRESHOLD
  const directEdgeThreshold = options.directEdgeThreshold ?? DEFAULT_DIRECT_EDGE_THRESHOLD

  const kalshi = comparison.markets.kalshi
  const polymarket = comparison.markets.polymarket
  const spreadA = comparison.crossMarket?.marketProbA?.spreadKalshiMinusPolymarket ?? null
  const spreadB = comparison.crossMarket?.marketProbB?.spreadKalshiMinusPolymarket ?? null

  const metrics = {
    kalshiEdgeA: kalshi?.fairVsMarket?.edgeA?.vsLast ?? null,
    kalshiEdgeB: kalshi?.fairVsMarket?.edgeB?.vsLast ?? null,
    polymarketEdgeA: polymarket?.fairVsMarket?.edgeA?.vsLast ?? null,
    polymarketEdgeB: polymarket?.fairVsMarket?.edgeB?.vsLast ?? null,
    crossSpreadA: spreadA,
    crossSpreadB: spreadB,
  }

  const directCandidateA = isDirectCandidate(kalshi) || isDirectCandidate(polymarket)
  const blockedCandidateA = isBlockedCandidate(kalshi) || isBlockedCandidate(polymarket)

  if (
    comparison.crossMarket.bothAvailable &&
    typeof spreadA === 'number' &&
    Number.isFinite(spreadA) &&
    Math.abs(spreadA) >= crossMarketSpreadThreshold &&
    directCandidateA
  ) {
    const side: 'teamA' | 'teamB' = spreadA > 0 ? 'teamA' : 'teamB'
    const primaryProvider = betterProviderForSide(kalshi, polymarket, side)
    return {
      type: side === 'teamA' ? 'cross_market_teamA' : 'cross_market_teamB',
      side,
      providersInvolved: ['kalshi', 'polymarket'],
      primaryProvider,
      reason: 'cross_market_spread_with_direct_candidate',
      metrics,
    }
  }

  const directViews: Array<{ provider: 'kalshi' | 'polymarket'; view: MultiMarketProviderView }> = []
  if (kalshi && isDirectCandidate(kalshi)) directViews.push({ provider: 'kalshi', view: kalshi })
  if (polymarket && isDirectCandidate(polymarket)) directViews.push({ provider: 'polymarket', view: polymarket })

  if (directViews.length) {
    const strongest = directViews.sort(
      (a, b) => abs(b.view.liveDecision.edgeVsLast) - abs(a.view.liveDecision.edgeVsLast),
    )[0]!
    const side = strongest.view.liveDecision.side === 'teamA' || strongest.view.liveDecision.side === 'teamB'
      ? strongest.view.liveDecision.side
      : 'none'
    const edge = strongest.view.liveDecision.edgeVsLast

    if (side !== 'none' && typeof edge === 'number' && Math.abs(edge) >= directEdgeThreshold) {
      return {
        type:
          strongest.provider === 'kalshi'
            ? side === 'teamA'
              ? 'single_market_kalshi_teamA'
              : 'single_market_kalshi_teamB'
            : side === 'teamA'
              ? 'single_market_polymarket_teamA'
              : 'single_market_polymarket_teamB',
        side,
        providersInvolved: [strongest.provider],
        primaryProvider: strongest.provider,
        reason: 'direct_candidate_single_market_dislocation',
        metrics,
      }
    }
  }

  if (blockedCandidateA) {
    const provider = isBlockedCandidate(kalshi) ? 'kalshi' : isBlockedCandidate(polymarket) ? 'polymarket' : 'none'
    const blockedView = provider === 'kalshi' ? kalshi : provider === 'polymarket' ? polymarket : null
    const side = blockedView?.liveDecision.side === 'teamA' || blockedView?.liveDecision.side === 'teamB'
      ? blockedView.liveDecision.side
      : 'none'
    return {
      type: 'blocked_candidate',
      side,
      providersInvolved: provider === 'none' ? [] : [provider],
      primaryProvider: provider,
      reason: 'candidate_blocked_by_market_eligibility',
      metrics,
    }
  }

  if (isWatchOnly(kalshi) || isWatchOnly(polymarket)) {
    const provider = isWatchOnly(kalshi) ? 'kalshi' : isWatchOnly(polymarket) ? 'polymarket' : 'none'
    const watchView = provider === 'kalshi' ? kalshi : provider === 'polymarket' ? polymarket : null
    const side = watchView?.liveDecision.side === 'teamA' || watchView?.liveDecision.side === 'teamB'
      ? watchView.liveDecision.side
      : 'none'
    return {
      type: 'watch_only_dislocation',
      side,
      providersInvolved: provider === 'none' ? [] : [provider],
      primaryProvider: provider,
      reason: 'watch_only_edge_without_tradeable_setup',
      metrics,
    }
  }

  return {
    type: 'no_setup',
    side: 'none',
    providersInvolved: [],
    primaryProvider: 'none',
    reason: 'no_actionable_dislocation_detected',
    metrics,
  }
}
