import { loadMultiMarketComparisons } from './multiMarketReport.js'
import type { MultiMarketComparison, MultiMarketProviderView } from './multiMarketComparison.js'
import { classifyTradeSetup, type TradeSetupType } from './setupTaxonomy.js'

export type ExecutionDatasetActionability = 'direct_candidate' | 'blocked_candidate' | 'watch_only'
export type ExecutionDatasetLegRole = 'single_market' | 'cheap_leg' | 'rich_leg' | 'blocked' | 'watch_only'

export interface ExecutionDatasetRow {
  version: 'execution-dataset-row/v1'
  capturedAt: string
  matchId: string | null
  flashscoreMatchUrl: string | null
  teamA: string | null
  teamB: string | null
  tourType: string
  qualityTier: string
  provider: 'kalshi' | 'polymarket'
  providerUrl: string | null
  setupType: TradeSetupType
  setupReason: string
  legRole: ExecutionDatasetLegRole
  actionability: ExecutionDatasetActionability
  side: 'teamA' | 'teamB'
  marketEligible: boolean
  liveDecisionAction: string
  blockedBy: string[]
  pFairSide: number | null
  pFairOtherSide: number | null
  marketBidSide: number | null
  marketAskSide: number | null
  marketMidSide: number | null
  marketLastSide: number | null
  edgeVsBidSide: number | null
  edgeVsAskSide: number | null
  edgeVsMidSide: number | null
  edgeVsLastSide: number | null
  spreadSide: number | null
  crossSpreadSameSide: number | null
  quoteHypotheses: {
    passivePrice: number | null
    aggressivePrice: number | null
    passiveTouchLabel: null
    fillBeforeMoveLabel: null
  }
}

export interface ExecutionDataset {
  version: 'execution-dataset/v1'
  generatedAt: string
  comparisonCount: number
  rowCount: number
  rows: ExecutionDatasetRow[]
}

function buildActionability(view: MultiMarketProviderView): ExecutionDatasetActionability | null {
  if (view.liveDecision.action === 'candidate') return 'direct_candidate'
  if (view.liveDecision.action === 'candidate_but_ineligible') return 'blocked_candidate'
  if (view.liveDecision.action === 'watch_only') return 'watch_only'
  return null
}

function pFairForSide(comparison: MultiMarketComparison, side: 'teamA' | 'teamB'): { side: number | null; other: number | null } {
  return side === 'teamA'
    ? {
        side: comparison.pFair.match.pMatchA ?? null,
        other: comparison.pFair.match.pMatchB ?? null,
      }
    : {
        side: comparison.pFair.match.pMatchB ?? null,
        other: comparison.pFair.match.pMatchA ?? null,
      }
}

function marketValuesForSide(view: MultiMarketProviderView, side: 'teamA' | 'teamB') {
  const marketProb = side === 'teamA' ? view.fairVsMarket.marketProbA : view.fairVsMarket.marketProbB
  const edge = side === 'teamA' ? view.fairVsMarket.edgeA : view.fairVsMarket.edgeB
  return {
    bid: marketProb.bid,
    ask: marketProb.ask,
    mid: marketProb.mid,
    last: marketProb.last,
    edgeVsBid: edge.vsBid,
    edgeVsAsk: edge.vsAsk,
    edgeVsMid: edge.vsMid,
    edgeVsLast: edge.vsLast,
    spread: marketProb.ask != null && marketProb.bid != null ? marketProb.ask - marketProb.bid : null,
  }
}

function crossSpreadForSide(comparison: MultiMarketComparison, side: 'teamA' | 'teamB'): number | null {
  return side === 'teamA'
    ? comparison.crossMarket.marketProbA.spreadKalshiMinusPolymarket
    : comparison.crossMarket.marketProbB.spreadKalshiMinusPolymarket
}

function inferLegRole(
  setupType: TradeSetupType,
  provider: 'kalshi' | 'polymarket',
  side: 'teamA' | 'teamB',
  comparison: MultiMarketComparison,
): ExecutionDatasetLegRole {
  if (setupType === 'blocked_candidate') return 'blocked'
  if (setupType === 'watch_only_dislocation') return 'watch_only'
  if (setupType.startsWith('single_market_')) return 'single_market'
  if (setupType.startsWith('cross_market_')) {
    const sameSideSpread = crossSpreadForSide(comparison, side)
    if (sameSideSpread == null) return 'single_market'
    return provider === 'kalshi'
      ? sameSideSpread > 0
        ? 'rich_leg'
        : 'cheap_leg'
      : sameSideSpread > 0
        ? 'cheap_leg'
        : 'rich_leg'
  }
  return 'single_market'
}

function providerViewsForSetup(
  setupType: TradeSetupType,
  comparison: MultiMarketComparison,
): Array<{ provider: 'kalshi' | 'polymarket'; view: MultiMarketProviderView }> {
  const rows: Array<{ provider: 'kalshi' | 'polymarket'; view: MultiMarketProviderView }> = []

  if (setupType.startsWith('cross_market_')) {
    if (comparison.markets.kalshi) rows.push({ provider: 'kalshi', view: comparison.markets.kalshi })
    if (comparison.markets.polymarket) rows.push({ provider: 'polymarket', view: comparison.markets.polymarket })
    return rows
  }

  if (setupType.includes('kalshi') && comparison.markets.kalshi) {
    rows.push({ provider: 'kalshi', view: comparison.markets.kalshi })
    return rows
  }

  if (setupType.includes('polymarket') && comparison.markets.polymarket) {
    rows.push({ provider: 'polymarket', view: comparison.markets.polymarket })
    return rows
  }

  if (setupType === 'blocked_candidate' || setupType === 'watch_only_dislocation') {
    if (comparison.markets.kalshi && buildActionability(comparison.markets.kalshi)) {
      rows.push({ provider: 'kalshi', view: comparison.markets.kalshi })
    }
    if (comparison.markets.polymarket && buildActionability(comparison.markets.polymarket)) {
      rows.push({ provider: 'polymarket', view: comparison.markets.polymarket })
    }
  }

  return rows
}

export function buildExecutionDatasetRows(
  comparison: MultiMarketComparison,
  options: { includeWatchOnly?: boolean; includeBlocked?: boolean } = {},
): ExecutionDatasetRow[] {
  const includeWatchOnly = options.includeWatchOnly ?? true
  const includeBlocked = options.includeBlocked ?? true
  const setup = classifyTradeSetup(comparison)

  if (setup.type === 'no_setup') return []
  if (setup.type === 'watch_only_dislocation' && !includeWatchOnly) return []
  if (setup.type === 'blocked_candidate' && !includeBlocked) return []
  if (setup.side === 'none') return []

  const providers = providerViewsForSetup(setup.type, comparison)

  return providers
    .map(({ provider, view }) => {
      const actionability = setup.type.startsWith('cross_market_') ? 'direct_candidate' : buildActionability(view)
      if (!actionability) return null

      const side = setup.side
      const pFair = pFairForSide(comparison, side)
      const market = marketValuesForSide(view, side)

      return {
        version: 'execution-dataset-row/v1',
        capturedAt: comparison.capturedAt,
        matchId: comparison.match.matchId,
        flashscoreMatchUrl: comparison.urls.flashscoreMatchUrl,
        teamA: comparison.match.teamA,
        teamB: comparison.match.teamB,
        tourType: comparison.prematchBaseline?.tourType || 'UNKNOWN',
        qualityTier: comparison.quality.tier,
        provider,
        providerUrl: view.url,
        setupType: setup.type,
        setupReason: setup.reason,
        legRole: inferLegRole(setup.type, provider, side, comparison),
        actionability,
        side,
        marketEligible: view.marketEligibility.eligible,
        liveDecisionAction: view.liveDecision.action,
        blockedBy: view.liveDecision.blockedBy,
        pFairSide: pFair.side,
        pFairOtherSide: pFair.other,
        marketBidSide: market.bid,
        marketAskSide: market.ask,
        marketMidSide: market.mid,
        marketLastSide: market.last,
        edgeVsBidSide: market.edgeVsBid,
        edgeVsAskSide: market.edgeVsAsk,
        edgeVsMidSide: market.edgeVsMid,
        edgeVsLastSide: market.edgeVsLast,
        spreadSide: market.spread,
        crossSpreadSameSide: crossSpreadForSide(comparison, side),
        quoteHypotheses: {
          passivePrice: market.bid,
          aggressivePrice: market.ask,
          passiveTouchLabel: null,
          fillBeforeMoveLabel: null,
        },
      } satisfies ExecutionDatasetRow
    })
    .filter((row): row is ExecutionDatasetRow => row != null)
}

export async function buildExecutionDataset(
  rootDir: string,
  options: { includeWatchOnly?: boolean; includeBlocked?: boolean } = {},
): Promise<ExecutionDataset> {
  const comparisons = await loadMultiMarketComparisons(rootDir)
  const rows = comparisons.flatMap((comparison) => buildExecutionDatasetRows(comparison, options))

  return {
    version: 'execution-dataset/v1',
    generatedAt: new Date().toISOString(),
    comparisonCount: comparisons.length,
    rowCount: rows.length,
    rows,
  }
}
