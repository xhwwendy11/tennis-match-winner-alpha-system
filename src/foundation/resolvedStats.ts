import type { KalshiDisplayStats } from '../kalshi/types.js'
import type { TennisFeedTeamStats } from '../realtime-score/tennis/types.js'

export type ResolvedStatsSource = 'kalshi_ui' | 'flashscore' | 'none'
export type ResolvedStatsConfidence = 'high' | 'medium' | 'low'

export interface ResolvedField<T> {
  value: T | null
  source: ResolvedStatsSource
  confidence: ResolvedStatsConfidence
}

export interface ResolvedStats {
  acesA: ResolvedField<number>
  acesB: ResolvedField<number>
  doubleFaultsA: ResolvedField<number>
  doubleFaultsB: ResolvedField<number>
  firstServePercentageA: ResolvedField<string>
  firstServePercentageB: ResolvedField<string>
  pointsWonA: ResolvedField<number>
  pointsWonB: ResolvedField<number>
  firstServeWonA: ResolvedField<string>
  firstServeWonB: ResolvedField<string>
  secondServeWonA: ResolvedField<string>
  secondServeWonB: ResolvedField<string>
  servicePointsWonA: ResolvedField<string>
  servicePointsWonB: ResolvedField<string>
  firstServeReturnPointsWonA: ResolvedField<string>
  firstServeReturnPointsWonB: ResolvedField<string>
  secondServeReturnPointsWonA: ResolvedField<string>
  secondServeReturnPointsWonB: ResolvedField<string>
  returnPointsWonA: ResolvedField<string>
  returnPointsWonB: ResolvedField<string>
  serviceGamesWonA: ResolvedField<number>
  serviceGamesWonB: ResolvedField<number>
  returnGamesWonA: ResolvedField<string>
  returnGamesWonB: ResolvedField<string>
  breakPointsSavedA: ResolvedField<string>
  breakPointsSavedB: ResolvedField<string>
  breakPointsConvertedA: ResolvedField<string>
  breakPointsConvertedB: ResolvedField<string>
  breakPointsDisplayA: ResolvedField<string>
  breakPointsDisplayB: ResolvedField<string>
}

function pickValue<T>(kalshiValue: T | null | undefined, flashscoreValue: T | null | undefined, opts?: { kalshiConfidence?: ResolvedStatsConfidence }): ResolvedField<T> {
  if (kalshiValue != null) {
    return {
      value: kalshiValue,
      source: 'kalshi_ui',
      confidence: opts?.kalshiConfidence || 'high',
    }
  }
  if (flashscoreValue != null) {
    return {
      value: flashscoreValue,
      source: 'flashscore',
      confidence: 'medium',
    }
  }
  return {
    value: null,
    source: 'none',
    confidence: 'low',
  }
}

export function buildResolvedStats(input: {
  flashscore: TennisFeedTeamStats | null | undefined
  kalshi: KalshiDisplayStats | null | undefined
}): ResolvedStats {
  const flashscore = input.flashscore
  const kalshi = input.kalshi

  return {
    acesA: pickValue(kalshi?.acesA, flashscore?.acesA),
    acesB: pickValue(kalshi?.acesB, flashscore?.acesB),
    doubleFaultsA: pickValue(kalshi?.doubleFaultsA, flashscore?.doubleFaultsA),
    doubleFaultsB: pickValue(kalshi?.doubleFaultsB, flashscore?.doubleFaultsB),
    firstServePercentageA: pickValue(null, flashscore?.firstServePercentageA),
    firstServePercentageB: pickValue(null, flashscore?.firstServePercentageB),
    pointsWonA: pickValue(kalshi?.pointsWonA, flashscore?.pointsWonA),
    pointsWonB: pickValue(kalshi?.pointsWonB, flashscore?.pointsWonB),
    firstServeWonA: pickValue(kalshi?.firstServeWonA, flashscore?.firstServeWonA),
    firstServeWonB: pickValue(kalshi?.firstServeWonB, flashscore?.firstServeWonB),
    secondServeWonA: pickValue(kalshi?.secondServeWonA, flashscore?.secondServeWonA),
    secondServeWonB: pickValue(kalshi?.secondServeWonB, flashscore?.secondServeWonB),
    servicePointsWonA: pickValue(null, flashscore?.servicePointsWonA),
    servicePointsWonB: pickValue(null, flashscore?.servicePointsWonB),
    firstServeReturnPointsWonA: pickValue(null, flashscore?.firstServeReturnPointsWonA),
    firstServeReturnPointsWonB: pickValue(null, flashscore?.firstServeReturnPointsWonB),
    secondServeReturnPointsWonA: pickValue(null, flashscore?.secondServeReturnPointsWonA),
    secondServeReturnPointsWonB: pickValue(null, flashscore?.secondServeReturnPointsWonB),
    returnPointsWonA: pickValue(null, flashscore?.returnPointsWonA),
    returnPointsWonB: pickValue(null, flashscore?.returnPointsWonB),
    serviceGamesWonA: pickValue(kalshi?.serviceGamesWonA, flashscore?.serviceGamesWonA),
    serviceGamesWonB: pickValue(kalshi?.serviceGamesWonB, flashscore?.serviceGamesWonB),
    returnGamesWonA: pickValue(null, flashscore?.returnGamesWonA),
    returnGamesWonB: pickValue(null, flashscore?.returnGamesWonB),
    breakPointsSavedA: pickValue(null, flashscore?.breakPointsSavedA),
    breakPointsSavedB: pickValue(null, flashscore?.breakPointsSavedB),
    breakPointsConvertedA: pickValue(null, flashscore?.breakPointsConvertedA),
    breakPointsConvertedB: pickValue(null, flashscore?.breakPointsConvertedB),
    breakPointsDisplayA: pickValue(kalshi?.breakPointsDisplayA, flashscore?.breakPointsDisplayA, { kalshiConfidence: 'low' }),
    breakPointsDisplayB: pickValue(kalshi?.breakPointsDisplayB, flashscore?.breakPointsDisplayB, { kalshiConfidence: 'low' }),
  }
}
