import type { CanonicalMarketState } from '../foundation/canonicalMarketState.js'
import type { KalshiOrderbookLevel, KalshiTrade } from './types.js'

export interface StoredKalshiMarketSnapshot {
  version: 'kalshi-market-snapshot/v1'
  capturedAt: string
  sourceUrl: string | null
  eventTicker: string | null
  marketTicker: string | null
  marketTitle: string | null
  marketStatus: CanonicalMarketState['marketStatus']
  prices: CanonicalMarketState['prices'] & {
    yesMid: number | null
    noMid: number | null
    spread: number | null
  }
  orderbook: {
    yes: KalshiOrderbookLevel[]
    no: KalshiOrderbookLevel[]
  }
  trades: {
    items: KalshiTrade[]
    cursor: string | null
  }
  liquidity: CanonicalMarketState['liquidity']
  timestamps: CanonicalMarketState['timestamps']
}

function normalizePrice(value: number | null): number | null {
  if (value == null || !Number.isFinite(value)) return null
  return value > 1 ? value / 100 : value
}

function midpoint(bid: number | null, ask: number | null): number | null {
  const normalizedBid = normalizePrice(bid)
  const normalizedAsk = normalizePrice(ask)
  if (normalizedBid == null || normalizedAsk == null) return null
  return (normalizedBid + normalizedAsk) / 2
}

function spread(bid: number | null, ask: number | null): number | null {
  const normalizedBid = normalizePrice(bid)
  const normalizedAsk = normalizePrice(ask)
  if (normalizedBid == null || normalizedAsk == null) return null
  return normalizedAsk - normalizedBid
}

export function buildKalshiMarketSnapshot(input: {
  capturedAt: string
  sourceUrl?: string | null
  marketState: CanonicalMarketState
  orderbook?: {
    yes?: KalshiOrderbookLevel[] | null
    no?: KalshiOrderbookLevel[] | null
  } | null
  trades?: {
    items?: KalshiTrade[] | null
    cursor?: string | null
  } | null
}): StoredKalshiMarketSnapshot {
  const market = input.marketState
  return {
    version: 'kalshi-market-snapshot/v1',
    capturedAt: input.capturedAt,
    sourceUrl: input.sourceUrl ?? null,
    eventTicker: market.eventTicker,
    marketTicker: market.marketTicker,
    marketTitle: market.marketTitle,
    marketStatus: market.marketStatus,
    prices: {
      ...market.prices,
      yesMid: midpoint(market.prices.yesBid, market.prices.yesAsk),
      noMid: midpoint(market.prices.noBid, market.prices.noAsk),
      spread: spread(market.prices.yesBid, market.prices.yesAsk),
    },
    orderbook: {
      yes: input.orderbook?.yes || [],
      no: input.orderbook?.no || [],
    },
    trades: {
      items: input.trades?.items || [],
      cursor: input.trades?.cursor ?? null,
    },
    liquidity: market.liquidity,
    timestamps: market.timestamps,
  }
}
