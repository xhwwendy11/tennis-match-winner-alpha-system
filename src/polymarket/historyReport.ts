import type { PolymarketMatchWinnerPriceSummary } from './types.js'

export interface PolymarketHistoryBucket {
  key: string
  marketCount: number
  tradedMarketCount: number
  settledMarketCount: number
  usdVolumeSum: number
  tradeCountSum: number
  meanUsdVolume: number | null
  medianUsdVolume: number | null
  meanTradeCount: number | null
  medianTradeCount: number | null
  meanAbsPriceMove: number | null
  medianAbsPriceMove: number | null
}

export interface PolymarketHistoryTopMarket {
  marketId: string
  question: string | null
  competitionHint: string | null
  playerA: string | null
  playerB: string | null
  winner: string
  tradeCount: number
  usdVolume: number
  firstTradePrice: number | null
  lastTradePrice: number | null
  absPriceMove: number | null
}

export interface PolymarketHistoryReport {
  version: 'polymarket-history-report/v1'
  generatedAt: string
  inputPath?: string
  priceSemantics: string
  overall: PolymarketHistoryBucket
  byCompetitionHint: PolymarketHistoryBucket[]
  byUsdVolumeBucket: PolymarketHistoryBucket[]
  byAbsPriceMoveBucket: PolymarketHistoryBucket[]
  topByUsdVolume: PolymarketHistoryTopMarket[]
  topByTradeCount: PolymarketHistoryTopMarket[]
  topByAbsPriceMove: PolymarketHistoryTopMarket[]
}

function round(value: number | null, decimals = 4): number | null {
  if (value == null || !Number.isFinite(value)) return null
  const scale = 10 ** decimals
  return Math.round(value * scale) / scale
}

function mean(values: number[]): number | null {
  if (!values.length) return null
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function median(values: number[]): number | null {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 0) return (sorted[mid - 1]! + sorted[mid]!) / 2
  return sorted[mid]!
}

function usdVolumeBucket(summary: PolymarketMatchWinnerPriceSummary): string {
  const usdVolume = summary.usdVolume || 0
  if (usdVolume === 0) return '0'
  if (usdVolume < 1_000) return '0-1k'
  if (usdVolume < 10_000) return '1k-10k'
  if (usdVolume < 100_000) return '10k-100k'
  return '100k+'
}

function absPriceMoveBucket(summary: PolymarketMatchWinnerPriceSummary): string {
  const move = Math.abs(summary.priceMove || 0)
  if (move === 0) return '0'
  if (move < 0.1) return '0-0.10'
  if (move < 0.25) return '0.10-0.25'
  if (move < 0.5) return '0.25-0.50'
  return '0.50+'
}

function toBucket(key: string, summaries: PolymarketMatchWinnerPriceSummary[]): PolymarketHistoryBucket {
  const usdVolumes = summaries.map((summary) => summary.usdVolume || 0)
  const tradeCounts = summaries.map((summary) => summary.tradeCount || 0)
  const absPriceMoves = summaries
    .map((summary) => summary.priceMove == null ? null : Math.abs(summary.priceMove))
    .filter((value): value is number => value != null && Number.isFinite(value))

  return {
    key,
    marketCount: summaries.length,
    tradedMarketCount: summaries.filter((summary) => summary.tradeCount > 0).length,
    settledMarketCount: summaries.filter((summary) => summary.winner !== 'unknown').length,
    usdVolumeSum: round(usdVolumes.reduce((sum, value) => sum + value, 0), 2) || 0,
    tradeCountSum: tradeCounts.reduce((sum, value) => sum + value, 0),
    meanUsdVolume: round(mean(usdVolumes), 2),
    medianUsdVolume: round(median(usdVolumes), 2),
    meanTradeCount: round(mean(tradeCounts), 2),
    medianTradeCount: round(median(tradeCounts), 2),
    meanAbsPriceMove: round(mean(absPriceMoves), 4),
    medianAbsPriceMove: round(median(absPriceMoves), 4),
  }
}

function bucketize(
  summaries: PolymarketMatchWinnerPriceSummary[],
  keyFn: (summary: PolymarketMatchWinnerPriceSummary) => string,
): PolymarketHistoryBucket[] {
  const buckets = new Map<string, PolymarketMatchWinnerPriceSummary[]>()
  for (const summary of summaries) {
    const key = keyFn(summary)
    const group = buckets.get(key)
    if (group) group.push(summary)
    else buckets.set(key, [summary])
  }
  return [...buckets.entries()]
    .map(([key, group]) => toBucket(key, group))
    .sort((a, b) => b.marketCount - a.marketCount || a.key.localeCompare(b.key))
}

function topMarket(summary: PolymarketMatchWinnerPriceSummary): PolymarketHistoryTopMarket {
  return {
    marketId: summary.marketId,
    question: summary.question,
    competitionHint: summary.competitionHint,
    playerA: summary.playerA,
    playerB: summary.playerB,
    winner: summary.winner,
    tradeCount: summary.tradeCount,
    usdVolume: round(summary.usdVolume, 2) || 0,
    firstTradePrice: round(summary.firstTradePrice, 4),
    lastTradePrice: round(summary.lastTradePrice, 4),
    absPriceMove: round(summary.priceMove == null ? null : Math.abs(summary.priceMove), 4),
  }
}

function topBy(
  summaries: PolymarketMatchWinnerPriceSummary[],
  valueFn: (summary: PolymarketMatchWinnerPriceSummary) => number,
  limit = 10,
): PolymarketHistoryTopMarket[] {
  return [...summaries]
    .sort((a, b) => valueFn(b) - valueFn(a))
    .slice(0, limit)
    .map(topMarket)
}

export function buildPolymarketHistoryReport(
  summaries: PolymarketMatchWinnerPriceSummary[],
  options: { inputPath?: string } = {},
): PolymarketHistoryReport {
  const firstSemantics = summaries.find((summary) => typeof summary.priceSemantics === 'string')?.priceSemantics
    || 'unknown'

  return {
    version: 'polymarket-history-report/v1',
    generatedAt: new Date().toISOString(),
    inputPath: options.inputPath,
    priceSemantics: firstSemantics,
    overall: toBucket('overall', summaries),
    byCompetitionHint: bucketize(summaries, (summary) => summary.competitionHint || 'UNKNOWN'),
    byUsdVolumeBucket: bucketize(summaries, usdVolumeBucket),
    byAbsPriceMoveBucket: bucketize(summaries, absPriceMoveBucket),
    topByUsdVolume: topBy(summaries, (summary) => summary.usdVolume || 0),
    topByTradeCount: topBy(summaries, (summary) => summary.tradeCount || 0),
    topByAbsPriceMove: topBy(summaries, (summary) => Math.abs(summary.priceMove || 0)),
  }
}
