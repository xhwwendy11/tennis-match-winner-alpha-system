import { loadDecisionSnapshots } from './calibrationReport.js'
import type { DecisionSnapshot } from './decisionSnapshot.js'
import { inferSnapshotQualityTier } from './snapshotReportEnrichment.js'

export interface CoverageQualityBucket {
  key: string
  sampleCount: number
  flashscoreStatsCoverage: number
  kalshiStatsCoverage: number
  prematchBaselineCoverage: number
  marketStateCoverage: number
  officialBaselineRate: number
  fallbackBaselineRate: number
  completeBaselineRate: number
  serveAvailableRate: number
  marketAskCoverage: number
  marketBidCoverage: number
  marketMidCoverage: number
  marketLastCoverage: number
}

export interface CoverageQualityReport {
  version: 'coverage-quality-report/v1'
  generatedAt: string
  snapshotCount: number
  overall: CoverageQualityBucket
  byTourType: CoverageQualityBucket[]
  byTourGender: CoverageQualityBucket[]
  byBaselineSource: CoverageQualityBucket[]
  byQualityTier: CoverageQualityBucket[]
  byIntegrity: CoverageQualityBucket[]
}

function ratio(numerator: number, denominator: number): number {
  if (!denominator) return 0
  return numerator / denominator
}

function bucketize(entries: DecisionSnapshot[], keyFn: (snapshot: DecisionSnapshot) => string): CoverageQualityBucket[] {
  const buckets = new Map<string, DecisionSnapshot[]>()

  for (const snapshot of entries) {
    const key = keyFn(snapshot)
    const group = buckets.get(key)
    if (group) group.push(snapshot)
    else buckets.set(key, [snapshot])
  }

  return [...buckets.entries()]
    .map(([key, group]) => toBucket(key, group))
    .sort((a, b) => b.sampleCount - a.sampleCount || a.key.localeCompare(b.key))
}

function toBucket(key: string, entries: DecisionSnapshot[]): CoverageQualityBucket {
  const sampleCount = entries.length
  const flashscoreStatsAvailable = entries.filter((snapshot) => snapshot.sourceCoverage.flashscoreStatsAvailable).length
  const kalshiStatsAvailable = entries.filter((snapshot) => snapshot.sourceCoverage.kalshiStatsAvailable).length
  const prematchBaselineAvailable = entries.filter((snapshot) => snapshot.sourceCoverage.prematchBaselineAvailable).length
  const marketStateAvailable = entries.filter((snapshot) => snapshot.sourceCoverage.marketStateAvailable).length

  const officialBaseline = entries.filter((snapshot) => snapshot.prematchBaseline?.source === 'tour_official').length
  const fallbackBaseline = entries.filter((snapshot) => snapshot.prematchBaseline?.source === 'fallback').length
  const completeBaseline = entries.filter((snapshot) => snapshot.prematchBaseline?.complete).length
  const serveAvailable = entries.filter((snapshot) => snapshot.match.serverSide != null).length

  const marketAsk = entries.filter((snapshot) => typeof snapshot.fairVsMarket.marketProbA.ask === 'number').length
  const marketBid = entries.filter((snapshot) => typeof snapshot.fairVsMarket.marketProbA.bid === 'number').length
  const marketMid = entries.filter((snapshot) => typeof snapshot.fairVsMarket.marketProbA.mid === 'number').length
  const marketLast = entries.filter((snapshot) => typeof snapshot.fairVsMarket.marketProbA.last === 'number').length

  return {
    key,
    sampleCount,
    flashscoreStatsCoverage: ratio(flashscoreStatsAvailable, sampleCount),
    kalshiStatsCoverage: ratio(kalshiStatsAvailable, sampleCount),
    prematchBaselineCoverage: ratio(prematchBaselineAvailable, sampleCount),
    marketStateCoverage: ratio(marketStateAvailable, sampleCount),
    officialBaselineRate: ratio(officialBaseline, sampleCount),
    fallbackBaselineRate: ratio(fallbackBaseline, sampleCount),
    completeBaselineRate: ratio(completeBaseline, sampleCount),
    serveAvailableRate: ratio(serveAvailable, sampleCount),
    marketAskCoverage: ratio(marketAsk, sampleCount),
    marketBidCoverage: ratio(marketBid, sampleCount),
    marketMidCoverage: ratio(marketMid, sampleCount),
    marketLastCoverage: ratio(marketLast, sampleCount),
  }
}

export async function buildCoverageQualityReport(rootDir: string): Promise<CoverageQualityReport> {
  const snapshots = await loadDecisionSnapshots(rootDir)

  return {
    version: 'coverage-quality-report/v1',
    generatedAt: new Date().toISOString(),
    snapshotCount: snapshots.length,
    overall: toBucket('overall', snapshots),
    byTourType: bucketize(snapshots, (snapshot) => snapshot.prematchBaseline?.tourType || 'UNKNOWN'),
    byTourGender: bucketize(
      snapshots,
      (snapshot) => `${snapshot.prematchBaseline?.tourType || 'UNKNOWN'}:${snapshot.match.gender || 'unknown'}`,
    ),
    byBaselineSource: bucketize(snapshots, (snapshot) => snapshot.prematchBaseline?.source || 'none'),
    byQualityTier: bucketize(snapshots, inferSnapshotQualityTier),
    byIntegrity: bucketize(snapshots, (snapshot) => snapshot.match.matchIntegrity || 'unknown'),
  }
}
