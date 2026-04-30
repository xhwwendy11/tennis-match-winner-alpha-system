import type { MarketStatus } from '../foundation/canonicalMarketState.js'

export interface KalshiEventRef {
  eventTicker: string
  title: string | null
  category: string | null
  subTitle: string | null
  status: string | null
}

export interface KalshiOrderbookLevel {
  price: number
  size: number
}

export interface KalshiTrade {
  tradeId: string | null
  ticker: string | null
  count: number | null
  yesPrice: number | null
  noPrice: number | null
  takerSide: string | null
  createdTime: string | null
}

export interface KalshiMarketSnapshot {
  eventTicker: string | null
  marketTicker: string | null
  marketTitle: string | null
  marketStatus: MarketStatus
  yesBid: number | null
  yesAsk: number | null
  noBid: number | null
  noAsk: number | null
  lastPrice: number | null
  volume: number | null
  marketTimestamp: string | null
  yesLevels: KalshiOrderbookLevel[]
  noLevels: KalshiOrderbookLevel[]
}

export interface KalshiDisplayStats {
  acesA: number | null
  acesB: number | null
  doubleFaultsA: number | null
  doubleFaultsB: number | null
  pointsWonA: number | null
  pointsWonB: number | null
  firstServeWonA: string | null
  firstServeWonB: string | null
  secondServeWonA: string | null
  secondServeWonB: string | null
  serviceGamesWonA: number | null
  serviceGamesWonB: number | null
  breakPointsDisplayA: string | null
  breakPointsDisplayB: string | null
}

export function normalizeKalshiMarketStatus(value: string | null | undefined): MarketStatus {
  const normalized = String(value || '').trim().toLowerCase()
  if (!normalized) return 'UNKNOWN'
  if (/(open|active)/.test(normalized)) return 'OPEN'
  if (/(pause|halt)/.test(normalized)) return 'PAUSED'
  if (/(settled|resolved|finalized)/.test(normalized)) return 'SETTLED'
  if (/(close|closed|inactive)/.test(normalized)) return 'CLOSED'
  return 'UNKNOWN'
}
