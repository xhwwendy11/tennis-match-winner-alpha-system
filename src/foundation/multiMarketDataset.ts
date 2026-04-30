import path from 'node:path'

import type { MultiMarketComparison } from './multiMarketComparison.js'

function safeSegment(value: string | null | undefined, fallback: string): string {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return normalized || fallback
}

export function buildMultiMarketComparisonFileName(comparison: MultiMarketComparison): string {
  return [
    safeSegment(comparison.capturedAt.replace(/[:.]/g, '-'), 'time'),
    safeSegment(comparison.match.matchId, 'unknown-match'),
    `${safeSegment(comparison.match.teamA, 'team-a')}-vs-${safeSegment(comparison.match.teamB, 'team-b')}.json`,
  ].join('__')
}

export function buildMultiMarketComparisonStoragePath(
  comparison: MultiMarketComparison,
  baseDir = 'multi-market-comparisons',
): string {
  const capturedAt = new Date(comparison.capturedAt)
  const year = Number.isFinite(capturedAt.getUTCFullYear()) ? String(capturedAt.getUTCFullYear()) : 'unknown-year'
  const month = Number.isFinite(capturedAt.getUTCMonth()) ? String(capturedAt.getUTCMonth() + 1).padStart(2, '0') : '00'
  const day = Number.isFinite(capturedAt.getUTCDate()) ? String(capturedAt.getUTCDate()).padStart(2, '0') : '00'
  return path.join(baseDir, year, month, day, buildMultiMarketComparisonFileName(comparison))
}
