import type { ExtractByUrlSuccess } from '../app/extractMatchByUrl.js'
import type { CanonicalMarketState } from './canonicalMarketState.js'
import { buildEdgeSignal, type EdgeSignal } from './edgeSignal.js'
import { buildFairMarketComparison, type FairMarketComparison } from './fairMarketComparison.js'
import { buildLiveDecision, type LiveDecision } from './liveDecision.js'
import { buildMarketEligibility, type MarketEligibility } from './marketEligibility.js'
import type { SnapshotQuality } from './snapshotQuality.js'

export interface MultiMarketProviderView {
  provider: CanonicalMarketState['provider']
  url: string | null
  market: CanonicalMarketState | null
  fairVsMarket: FairMarketComparison
  marketEligibility: MarketEligibility
  edgeSignal: EdgeSignal
  liveDecision: LiveDecision
}

export interface MultiMarketComparison {
  version: 'multi-market-comparison/v1'
  capturedAt: string
  urls: {
    flashscoreMatchUrl: string | null
    flashscoreSourcePageUrl: string | null
    kalshiMarketUrl: string | null
    polymarketMarketUrl: string | null
  }
  match: ExtractByUrlSuccess['decisionSnapshot']['match']
  quality: SnapshotQuality
  prematchBaseline: ExtractByUrlSuccess['prematchBaseline']
  pFair: ExtractByUrlSuccess['probabilityState']['pFair']
  markets: {
    kalshi: MultiMarketProviderView | null
    polymarket: MultiMarketProviderView | null
  }
  crossMarket: {
    bothAvailable: boolean
    marketProbA: {
      kalshiLast: number | null
      polymarketLast: number | null
      spreadKalshiMinusPolymarket: number | null
    }
    marketProbB: {
      kalshiLast: number | null
      polymarketLast: number | null
      spreadKalshiMinusPolymarket: number | null
    }
    betterValueForTeamA: 'kalshi' | 'polymarket' | 'tie' | 'unknown'
    betterValueForTeamB: 'kalshi' | 'polymarket' | 'tie' | 'unknown'
  }
}

function diff(a: number | null, b: number | null): number | null {
  if (a == null || b == null) return null
  return a - b
}

function chooseBetterValue(a: number | null, b: number | null): 'kalshi' | 'polymarket' | 'tie' | 'unknown' {
  if (a == null || b == null) return 'unknown'
  if (Math.abs(a - b) < 1e-9) return 'tie'
  return a > b ? 'kalshi' : 'polymarket'
}

function buildProviderView(
  base: ExtractByUrlSuccess,
  marketState: CanonicalMarketState | null,
  marketUrl: string | null,
): MultiMarketProviderView | null {
  if (!marketState) return null

  const fairVsMarket = buildFairMarketComparison({
    pFair: base.probabilityState.pFair,
    marketState,
    matchState: base.canonicalMatchState,
  })
  const edgeSignal = buildEdgeSignal({
    fairVsMarket,
    qualityTier: base.decisionSnapshot.quality.tier,
  })
  const marketEligibility = buildMarketEligibility({
    marketState,
    fairVsMarket,
    capturedAt: base.decisionSnapshot.capturedAt,
  })
  const liveDecision = buildLiveDecision({
    edgeSignal,
    marketEligibility,
  })

  return {
    provider: marketState.provider,
    url: marketUrl,
    market: marketState,
    fairVsMarket,
    marketEligibility,
    edgeSignal,
    liveDecision,
  }
}

export function buildMultiMarketComparison(input: {
  base: ExtractByUrlSuccess
  kalshiMarketState?: CanonicalMarketState | null
  kalshiMarketUrl?: string | null
  polymarketMarketState?: CanonicalMarketState | null
  polymarketMarketUrl?: string | null
}): MultiMarketComparison {
  const kalshi = buildProviderView(input.base, input.kalshiMarketState ?? null, input.kalshiMarketUrl ?? null)
  const polymarket = buildProviderView(input.base, input.polymarketMarketState ?? null, input.polymarketMarketUrl ?? null)

  return {
    version: 'multi-market-comparison/v1',
    capturedAt: input.base.decisionSnapshot.capturedAt,
    urls: {
      flashscoreMatchUrl: input.base.decisionSnapshot.urls.flashscoreMatchUrl,
      flashscoreSourcePageUrl: input.base.decisionSnapshot.urls.flashscoreSourcePageUrl,
      kalshiMarketUrl: input.kalshiMarketUrl ?? null,
      polymarketMarketUrl: input.polymarketMarketUrl ?? null,
    },
    match: input.base.decisionSnapshot.match,
    quality: input.base.decisionSnapshot.quality,
    prematchBaseline: input.base.prematchBaseline,
    pFair: input.base.probabilityState.pFair,
    markets: {
      kalshi,
      polymarket,
    },
    crossMarket: {
      bothAvailable: !!kalshi && !!polymarket,
      marketProbA: {
        kalshiLast: kalshi?.fairVsMarket.marketProbA.last ?? null,
        polymarketLast: polymarket?.fairVsMarket.marketProbA.last ?? null,
        spreadKalshiMinusPolymarket: diff(kalshi?.fairVsMarket.marketProbA.last ?? null, polymarket?.fairVsMarket.marketProbA.last ?? null),
      },
      marketProbB: {
        kalshiLast: kalshi?.fairVsMarket.marketProbB.last ?? null,
        polymarketLast: polymarket?.fairVsMarket.marketProbB.last ?? null,
        spreadKalshiMinusPolymarket: diff(kalshi?.fairVsMarket.marketProbB.last ?? null, polymarket?.fairVsMarket.marketProbB.last ?? null),
      },
      betterValueForTeamA: chooseBetterValue(kalshi?.fairVsMarket.edgeA.vsLast ?? null, polymarket?.fairVsMarket.edgeA.vsLast ?? null),
      betterValueForTeamB: chooseBetterValue(kalshi?.fairVsMarket.edgeB.vsLast ?? null, polymarket?.fairVsMarket.edgeB.vsLast ?? null),
    },
  }
}
