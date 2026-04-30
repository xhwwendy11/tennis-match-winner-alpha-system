import path from 'node:path'

import type { DecisionSnapshot } from './decisionSnapshot.js'
import type { StoredKalshiMarketSnapshot } from '../kalshi/marketSnapshot.js'

function safeSegment(value: string | null | undefined, fallback: string): string {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return normalized || fallback
}

export function buildSnapshotFileName(snapshot: DecisionSnapshot): string {
  const matchId = safeSegment(snapshot.match.matchId, 'unknown-match')
  const teamA = safeSegment(snapshot.match.teamA, 'team-a')
  const teamB = safeSegment(snapshot.match.teamB, 'team-b')
  const capturedAt = safeSegment(snapshot.capturedAt.replace(/[:.]/g, '-'), 'time')
  return `${capturedAt}__${matchId}__${teamA}-vs-${teamB}.json`
}

export function buildSnapshotStoragePath(snapshot: DecisionSnapshot, baseDir = 'snapshots'): string {
  const capturedAt = new Date(snapshot.capturedAt)
  const year = Number.isFinite(capturedAt.getUTCFullYear()) ? String(capturedAt.getUTCFullYear()) : 'unknown-year'
  const month = Number.isFinite(capturedAt.getUTCMonth()) ? String(capturedAt.getUTCMonth() + 1).padStart(2, '0') : '00'
  const day = Number.isFinite(capturedAt.getUTCDate()) ? String(capturedAt.getUTCDate()).padStart(2, '0') : '00'

  return path.join(baseDir, year, month, day, buildSnapshotFileName(snapshot))
}

export function buildKalshiMarketSnapshotFileName(snapshot: StoredKalshiMarketSnapshot): string {
  const marketTicker = safeSegment(snapshot.marketTicker, 'unknown-market')
  const capturedAt = safeSegment(snapshot.capturedAt.replace(/[:.]/g, '-'), 'time')
  return `${capturedAt}__${marketTicker}.json`
}

export function buildKalshiMarketSnapshotStoragePath(
  snapshot: StoredKalshiMarketSnapshot,
  baseDir = 'market-snapshots/kalshi',
): string {
  const capturedAt = new Date(snapshot.capturedAt)
  const year = Number.isFinite(capturedAt.getUTCFullYear()) ? String(capturedAt.getUTCFullYear()) : 'unknown-year'
  const month = Number.isFinite(capturedAt.getUTCMonth()) ? String(capturedAt.getUTCMonth() + 1).padStart(2, '0') : '00'
  const day = Number.isFinite(capturedAt.getUTCDate()) ? String(capturedAt.getUTCDate()).padStart(2, '0') : '00'

  return path.join(baseDir, year, month, day, buildKalshiMarketSnapshotFileName(snapshot))
}
