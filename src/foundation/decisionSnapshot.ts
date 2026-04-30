import type { CanonicalMatchState } from './canonicalMatchState.js'
import type { CanonicalMarketState } from './canonicalMarketState.js'
import { buildFairMarketComparison, type FairMarketComparison } from './fairMarketComparison.js'
import { buildLiveDecision, type LiveDecision } from './liveDecision.js'
import { buildMarketEligibility, type MarketEligibility } from './marketEligibility.js'
import type { PrematchBaseline } from './prematchBaseline.js'
import type { ResolvedStats } from './resolvedStats.js'
import type { TennisProbabilityState } from '../probability/probabilityState.js'
import type { KalshiDisplayStats } from '../kalshi/types.js'
import type { TennisPointRiskDecision } from '../rules/tennis/pointRiskEngine.js'
import type { TennisTradePlan } from '../rules/tennis/tradePlan.js'
import { buildSnapshotQuality, type SnapshotQuality } from './snapshotQuality.js'
import { buildEdgeSignal, type EdgeSignal } from './edgeSignal.js'

export interface DecisionSnapshot {
  version: 'decision-snapshot/v1'
  capturedAt: string
  urls: {
    flashscoreMatchUrl: string | null
    flashscoreSourcePageUrl: string | null
    kalshiMarketUrl: string | null
    polymarketMarketUrl: string | null
  }
  match: {
    matchId: string | null
    tournamentName: string | null
    round: string | null
    gender: CanonicalMatchState['competition']['gender'] | null
    discipline: CanonicalMatchState['competition']['discipline'] | null
    teamA: string | null
    teamB: string | null
    status: string | null
    abnormalReason: CanonicalMatchState['status']['abnormalReason'] | null
    setIndex: number | null
    isTiebreak: boolean
    setsWonA: number | null
    setsWonB: number | null
    currentSetGamesA: number | null
    currentSetGamesB: number | null
    currentGamePointsA: string | null
    currentGamePointsB: string | null
    serverSide: CanonicalMatchState['serve']['resolved'] | null
    matchIntegrity: CanonicalMatchState['quality']['matchIntegrity'] | null
  }
  sourceCoverage: {
    flashscoreStatsAvailable: boolean
    kalshiStatsAvailable: boolean
    prematchBaselineAvailable: boolean
    marketStateAvailable: boolean
  }
  quality: SnapshotQuality
  market: CanonicalMarketState | null
  fairVsMarket: FairMarketComparison
  marketEligibility: MarketEligibility
  edgeSignal: EdgeSignal
  liveDecision: LiveDecision
  stats: {
    resolved: ResolvedStats
    kalshiDisplay: KalshiDisplayStats | null
  }
  prematchBaseline: PrematchBaseline | null
  risk: {
    level: TennisPointRiskDecision['finalRisk']
    machineCommand: TennisPointRiskDecision['machineCommand']
    matchedRule: string | null
    phase: TennisPointRiskDecision['phase']
    stopTriggered: boolean
  }
  pFair: TennisProbabilityState['pFair']
  tradePlan: {
    tradeMode: TennisTradePlan['tradeMode']
    jumpPhase: boolean
    exposureAllowed: boolean
    preferredSide: TennisTradePlan['preferredSide']
    summary: string
  }
}

export function buildDecisionSnapshot(input: {
  capturedAt?: string | null
  canonicalMatchState: CanonicalMatchState | null
  canonicalMarketState: CanonicalMarketState | null
  kalshiMarketUrl: string | null
  polymarketMarketUrl?: string | null
  kalshiDisplayStats: KalshiDisplayStats | null
  resolvedStats: ResolvedStats
  prematchBaseline: PrematchBaseline | null
  pointRisk: TennisPointRiskDecision
  probabilityState: TennisProbabilityState
  tradePlan: TennisTradePlan
}): DecisionSnapshot {
  const state = input.canonicalMatchState
  const quality = buildSnapshotQuality({
    matchState: state,
    prematchBaseline: input.prematchBaseline,
    probabilityState: input.probabilityState,
    resolvedStats: input.resolvedStats,
  })
  const fairVsMarket = buildFairMarketComparison({
    pFair: input.probabilityState.pFair,
    marketState: input.canonicalMarketState,
    matchState: input.canonicalMatchState,
  })
  const capturedAt = input.capturedAt || new Date().toISOString()
  const edgeSignal = buildEdgeSignal({
    fairVsMarket,
    qualityTier: quality.tier,
  })
  const marketEligibility = buildMarketEligibility({
    marketState: input.canonicalMarketState,
    fairVsMarket,
    capturedAt,
  })
  const liveDecision = buildLiveDecision({
    edgeSignal,
    marketEligibility,
  })

  return {
    version: 'decision-snapshot/v1',
    capturedAt,
    urls: {
      flashscoreMatchUrl: state?.source.matchUrl ?? null,
      flashscoreSourcePageUrl: state?.source.sourcePageUrl ?? null,
      kalshiMarketUrl: input.kalshiMarketUrl,
      polymarketMarketUrl: input.polymarketMarketUrl ?? null,
    },
    match: {
      matchId: state?.matchId ?? null,
      tournamentName: state?.competition.tournamentName ?? null,
      round: state?.competition.round ?? null,
      gender: state?.competition.gender ?? null,
      discipline: state?.competition.discipline ?? null,
      teamA: state?.participants.teamA.name ?? null,
      teamB: state?.participants.teamB.name ?? null,
      status: state?.status.matchStatus ?? null,
      abnormalReason: state?.status.abnormalReason ?? null,
      setIndex: state?.scoreboard.setIndex ?? null,
      isTiebreak: state?.scoreboard.isTiebreak ?? false,
      setsWonA: state?.scoreboard.setsWonA ?? null,
      setsWonB: state?.scoreboard.setsWonB ?? null,
      currentSetGamesA: state?.scoreboard.currentSetGamesA ?? null,
      currentSetGamesB: state?.scoreboard.currentSetGamesB ?? null,
      currentGamePointsA: state?.scoreboard.currentGamePointsA ?? null,
      currentGamePointsB: state?.scoreboard.currentGamePointsB ?? null,
      serverSide: state?.serve.resolved ?? null,
      matchIntegrity: state?.quality.matchIntegrity ?? null,
    },
    sourceCoverage: {
      flashscoreStatsAvailable: !!state?.stats,
      kalshiStatsAvailable: !!input.kalshiDisplayStats,
      prematchBaselineAvailable: !!input.prematchBaseline,
      marketStateAvailable: !!input.canonicalMarketState,
    },
    quality,
    market: input.canonicalMarketState,
    fairVsMarket,
    marketEligibility,
    edgeSignal,
    liveDecision,
    stats: {
      resolved: input.resolvedStats,
      kalshiDisplay: input.kalshiDisplayStats,
    },
    prematchBaseline: input.prematchBaseline,
    risk: {
      level: input.pointRisk.finalRisk,
      machineCommand: input.pointRisk.machineCommand,
      matchedRule: input.pointRisk.matchedRule,
      phase: input.pointRisk.phase,
      stopTriggered: input.pointRisk.stopTriggered,
    },
    pFair: input.probabilityState.pFair,
    tradePlan: {
      tradeMode: input.tradePlan.tradeMode,
      jumpPhase: input.tradePlan.jumpPhase,
      exposureAllowed: input.tradePlan.exposureAllowed,
      preferredSide: input.tradePlan.preferredSide,
      summary: input.tradePlan.summary,
    },
  }
}
