import type { TourType } from './canonicalMatchState.js'

export type BaselineSource = 'none' | 'manual' | 'tour_official' | 'market' | 'flashscore_history' | 'fallback'
export type StrengthBucket =
  | 'unknown'
  | 'strong_favorite'
  | 'favorite'
  | 'balanced'
  | 'underdog'
  | 'strong_underdog'

export interface PrematchBaseline {
  source: BaselineSource
  complete: boolean
  bestOf: 3 | 5 | null
  surface: 'hard' | 'clay' | 'grass' | 'indoor' | 'unknown'
  tourType: TourType
  prematchFairProbA: number | null
  prematchFairProbB: number | null
  strengthBucketA: StrengthBucket
  strengthBucketB: StrengthBucket
  pointBaselineA?: number | null
  pointBaselineB?: number | null
  holdBaselineA: number | null
  holdBaselineB: number | null
  breakBaselineA: number | null
  breakBaselineB: number | null
}

export function clampProbability(value: number | null): number | null {
  if (value == null || !Number.isFinite(value)) return null
  return Math.max(0, Math.min(1, value))
}

export function normalizeTwoWayProbabilities(input: {
  probA?: number | null
  probB?: number | null
}): { probA: number | null; probB: number | null } {
  const rawA = clampProbability(input.probA ?? null)
  const rawB = clampProbability(input.probB ?? null)

  if (rawA != null && rawB == null) {
    return { probA: rawA, probB: clampProbability(1 - rawA) }
  }

  if (rawB != null && rawA == null) {
    return { probA: clampProbability(1 - rawB), probB: rawB }
  }

  if (rawA == null || rawB == null) {
    return { probA: null, probB: null }
  }

  const total = rawA + rawB
  if (total === 0) return { probA: null, probB: null }
  return {
    probA: rawA / total,
    probB: rawB / total,
  }
}

export function inferStrengthBucket(prob: number | null): StrengthBucket {
  if (prob == null) return 'unknown'
  if (prob >= 0.75) return 'strong_favorite'
  if (prob >= 0.6) return 'favorite'
  if (prob > 0.4 && prob < 0.6) return 'balanced'
  if (prob > 0.25) return 'underdog'
  return 'strong_underdog'
}
