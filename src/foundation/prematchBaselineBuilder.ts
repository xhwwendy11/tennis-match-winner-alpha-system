import type { AtpPlayerBaseline } from '../atp/types.js'
import type { FlashscoreHistoricalPlayerBaseline } from '../flashscore/historicalBaseline.js'
import type { CanonicalMatchState } from './canonicalMatchState.js'
import {
  inferStrengthBucket,
  normalizeTwoWayProbabilities,
  type PrematchBaseline,
} from './prematchBaseline.js'
import type { ItfPlayerBaseline } from '../itf/types.js'
import { getTourBaselineDefaults } from '../probability/config.js'
import type { WtaPlayerBaseline } from '../wta/types.js'

export type PlayerBaseline = AtpPlayerBaseline | WtaPlayerBaseline | ItfPlayerBaseline | FlashscoreHistoricalPlayerBaseline

export interface PrematchBaselineBuilderInput {
  matchState: CanonicalMatchState | null
  playerA: PlayerBaseline | null
  playerB: PlayerBaseline | null
  marketImpliedProbA?: number | null
  marketImpliedProbB?: number | null
  surface?: PrematchBaseline['surface'] | null
}

function defaultHoldBaselineForTour(tourType: PrematchBaseline['tourType']): number {
  return getTourBaselineDefaults(tourType).hold
}

function defaultBreakBaselineForTour(tourType: PrematchBaseline['tourType']): number {
  return getTourBaselineDefaults(tourType).break
}

function holdBaselineFor(player: PlayerBaseline | null): number | null {
  if (!player) return null
  if ('serviceGamesWonPercentage' in player.serve) {
    if (player.serve.serviceGamesPlayed === 0) return null
    const pct = player.serve.serviceGamesWonPercentage
    return typeof pct === 'number' ? pct / 100 : null
  }
  return null
}

function breakBaselineFor(player: PlayerBaseline | null): number | null {
  if (!player) return null
  if ('returnGamesWonPercentage' in player.return) {
    if (player.return.returnGamesPlayed === 0) return null
    const pct = player.return.returnGamesWonPercentage
    return typeof pct === 'number' ? pct / 100 : null
  }
  return null
}

export function buildPrematchBaseline(input: PrematchBaselineBuilderInput): PrematchBaseline {
  const tourType = input.matchState?.competition.tourType ?? 'UNKNOWN'
  const normalizedFair = normalizeTwoWayProbabilities({
    probA: input.marketImpliedProbA ?? null,
    probB: input.marketImpliedProbB ?? null,
  })

  const holdBaselineA = holdBaselineFor(input.playerA) ?? defaultHoldBaselineForTour(tourType)
  const holdBaselineB = holdBaselineFor(input.playerB) ?? defaultHoldBaselineForTour(tourType)
  const breakBaselineA = breakBaselineFor(input.playerA) ?? defaultBreakBaselineForTour(tourType)
  const breakBaselineB = breakBaselineFor(input.playerB) ?? defaultBreakBaselineForTour(tourType)

  const source: PrematchBaseline['source'] =
    normalizedFair.probA != null && normalizedFair.probB != null
      ? 'market'
      : input.playerA?.source === 'flashscore_history' || input.playerB?.source === 'flashscore_history'
        ? 'flashscore_history'
      : input.playerA || input.playerB
        ? 'tour_official'
        : 'fallback'

  const rawComplete =
    holdBaselineFor(input.playerA) != null &&
    holdBaselineFor(input.playerB) != null &&
    breakBaselineFor(input.playerA) != null &&
    breakBaselineFor(input.playerB) != null

  const complete =
    source === 'tour_official' || source === 'flashscore_history'
      ? rawComplete
      : (
    holdBaselineA != null &&
    holdBaselineB != null &&
    breakBaselineA != null &&
    breakBaselineB != null
        )

  return {
    source,
    complete,
    bestOf: input.matchState?.competition.bestOf ?? null,
    surface: input.surface ?? 'unknown',
    tourType,
    prematchFairProbA: normalizedFair.probA,
    prematchFairProbB: normalizedFair.probB,
    strengthBucketA: inferStrengthBucket(normalizedFair.probA),
    strengthBucketB: inferStrengthBucket(normalizedFair.probB),
    holdBaselineA,
    holdBaselineB,
    breakBaselineA,
    breakBaselineB,
  }
}
