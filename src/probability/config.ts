import type { TourType } from '../foundation/canonicalMatchState.js'

export interface TourBaselineDefaults {
  hold: number
  break: number
}

export interface PFairRiskAdjustments {
  high: number
  veryHigh: number
  stopTriggered: number
}

export interface PFairStatsAdjustmentWeights {
  pointsWon: number
  serviceGamesWon: number
  doubleFaultsPerDiff: number
  returnPointsWon: number
  firstServeReturnPointsWon: number
  secondServeReturnPointsWon: number
  breakPointsSaved: number
  breakPointsConverted: number
  maxAbsoluteAdjustment: number
}

export interface PFairConfig {
  holdToPointScale: number
  riskAdjustments: PFairRiskAdjustments
  statsWeights: PFairStatsAdjustmentWeights
}

export const TOUR_BASELINE_DEFAULTS: Record<TourType, TourBaselineDefaults> = {
  ATP: { hold: 0.8, break: 0.2 },
  ATP_CHALLENGER: { hold: 0.77, break: 0.23 },
  WTA: { hold: 0.68, break: 0.32 },
  WTA_CHALLENGER: { hold: 0.68, break: 0.32 },
  ITF: { hold: 0.72, break: 0.28 },
  UNKNOWN: { hold: 0.74, break: 0.26 },
}

export const DEFAULT_PFAIR_CONFIG: PFairConfig = {
  holdToPointScale: 0.55,
  riskAdjustments: {
    high: 0.015,
    veryHigh: 0.03,
    stopTriggered: 0.02,
  },
  statsWeights: {
    pointsWon: 0.06,
    serviceGamesWon: 0.03,
    doubleFaultsPerDiff: 0.004,
    returnPointsWon: 0.08,
    firstServeReturnPointsWon: 0.035,
    secondServeReturnPointsWon: 0.045,
    breakPointsSaved: 0.025,
    breakPointsConverted: 0.025,
    maxAbsoluteAdjustment: 0.12,
  },
}

export function getTourBaselineDefaults(tourType: TourType): TourBaselineDefaults {
  return TOUR_BASELINE_DEFAULTS[tourType] ?? TOUR_BASELINE_DEFAULTS.UNKNOWN
}
