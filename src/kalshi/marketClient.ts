import { buildCanonicalMarketState, type CanonicalMarketState } from '../foundation/canonicalMarketState.js'
import { KalshiClient } from './client.js'
import {
  normalizeKalshiMarketStatus,
  type KalshiMarketSnapshot,
  type KalshiOrderbookLevel,
  type KalshiTrade,
} from './types.js'

interface KalshiMarketResponse {
  market?: {
    ticker?: string | null
    event_ticker?: string | null
    title?: string | null
    status?: string | null
    last_price?: number | null
    last_price_dollars?: string | number | null
    volume?: number | null
    volume_fp?: string | number | null
    yes_bid?: number | null
    yes_bid_dollars?: string | number | null
    yes_ask?: number | null
    yes_ask_dollars?: string | number | null
    no_bid?: number | null
    no_bid_dollars?: string | number | null
    no_ask?: number | null
    no_ask_dollars?: string | number | null
    close_time?: string | null
    updated_at?: string | null
    updated_time?: string | null
  } | null
}

interface KalshiOrderbookResponse {
  orderbook?: {
    yes?: Array<[number, number]> | null
    no?: Array<[number, number]> | null
  } | null
  orderbook_fp?: {
    yes_dollars?: Array<[string | number, string | number]> | null
    no_dollars?: Array<[string | number, string | number]> | null
  } | null
}

interface KalshiTradesResponse {
  trades?: Array<{
    trade_id?: string | null
    id?: string | null
    ticker?: string | null
    count?: number | null
    count_fp?: string | number | null
    yes_price?: number | null
    no_price?: number | null
    yes_price_dollars?: string | number | null
    no_price_dollars?: string | number | null
    taker_side?: string | null
    created_time?: string | null
    created_at?: string | null
  }> | null
  cursor?: string | null
}

export interface KalshiTradesSnapshot {
  trades: KalshiTrade[]
  cursor: string | null
}

export function normalizeOrderbookLevels(
  levels: Array<[string | number, string | number]> | null | undefined,
): KalshiOrderbookLevel[] {
  return (levels || [])
    .filter((level): level is [string | number, string | number] => Array.isArray(level) && level.length >= 2)
    .map(([price, size]) => ({
      price: Number(price),
      size: Number(size),
    }))
    .filter((level) => Number.isFinite(level.price) && Number.isFinite(level.size))
}

function toNullableString(value: unknown): string | null {
  const text = String(value ?? '').trim()
  return text ? text : null
}

function toNullableNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function firstNullableNumber(...values: unknown[]): number | null {
  for (const value of values) {
    const parsed = toNullableNumber(value)
    if (parsed != null) return parsed
  }
  return null
}

export function normalizeKalshiTrades(response: KalshiTradesResponse | null | undefined): KalshiTradesSnapshot {
  return {
    cursor: toNullableString(response?.cursor),
    trades: (response?.trades || [])
      .map((trade) => ({
        tradeId: toNullableString(trade.trade_id ?? trade.id),
        ticker: toNullableString(trade.ticker),
        count: toNullableNumber(trade.count ?? trade.count_fp),
        yesPrice: toNullableNumber(trade.yes_price ?? trade.yes_price_dollars),
        noPrice: toNullableNumber(trade.no_price ?? trade.no_price_dollars),
        takerSide: toNullableString(trade.taker_side),
        createdTime: toNullableString(trade.created_time ?? trade.created_at),
      }))
      .filter((trade) => trade.tradeId || trade.ticker || trade.createdTime),
  }
}

export function toKalshiMarketSnapshot(
  marketResponse: KalshiMarketResponse,
  orderbookResponse?: KalshiOrderbookResponse | null,
): KalshiMarketSnapshot {
  const market = marketResponse.market || null
  const yesLevels = normalizeOrderbookLevels(
    orderbookResponse?.orderbook_fp?.yes_dollars || orderbookResponse?.orderbook?.yes,
  )
  const noLevels = normalizeOrderbookLevels(
    orderbookResponse?.orderbook_fp?.no_dollars || orderbookResponse?.orderbook?.no,
  )

  return {
    eventTicker: market?.event_ticker ?? null,
    marketTicker: market?.ticker ?? null,
    marketTitle: market?.title ?? null,
    marketStatus: normalizeKalshiMarketStatus(market?.status),
    yesBid: firstNullableNumber(market?.yes_bid, market?.yes_bid_dollars, yesLevels[0]?.price),
    yesAsk: firstNullableNumber(market?.yes_ask, market?.yes_ask_dollars),
    noBid: firstNullableNumber(market?.no_bid, market?.no_bid_dollars, noLevels[0]?.price),
    noAsk: firstNullableNumber(market?.no_ask, market?.no_ask_dollars),
    lastPrice: firstNullableNumber(market?.last_price, market?.last_price_dollars),
    volume: firstNullableNumber(market?.volume, market?.volume_fp),
    marketTimestamp: market?.updated_at ?? market?.updated_time ?? market?.close_time ?? null,
    yesLevels,
    noLevels,
  }
}

export function toCanonicalMarketState(snapshot: KalshiMarketSnapshot): CanonicalMarketState {
  return buildCanonicalMarketState({
    provider: 'kalshi',
    eventTicker: snapshot.eventTicker,
    marketTicker: snapshot.marketTicker,
    marketTitle: snapshot.marketTitle,
    marketStatus: snapshot.marketStatus,
    yesBid: snapshot.yesBid,
    yesAsk: snapshot.yesAsk,
    noBid: snapshot.noBid,
    noAsk: snapshot.noAsk,
    lastPrice: snapshot.lastPrice,
    volume: snapshot.volume,
    marketTimestamp: snapshot.marketTimestamp,
  })
}

export async function fetchKalshiTrades(
  marketTicker: string,
  client = new KalshiClient(),
  options: { limit?: number } = {},
): Promise<KalshiTradesSnapshot> {
  const response = await client.getJson<KalshiTradesResponse>('/markets/trades', {
    query: {
      ticker: marketTicker,
      limit: options.limit ?? 100,
    },
  })
  return normalizeKalshiTrades(response)
}

export async function fetchKalshiMarketSnapshot(
  marketTicker: string,
  client = new KalshiClient(),
): Promise<KalshiMarketSnapshot> {
  const marketResponse = await client.getJson<KalshiMarketResponse>(`/markets/${encodeURIComponent(marketTicker)}`)
  let orderbookResponse: KalshiOrderbookResponse | null = null

  try {
    orderbookResponse = await client.getJson<KalshiOrderbookResponse>(`/markets/${encodeURIComponent(marketTicker)}/orderbook`)
  } catch {
    orderbookResponse = null
  }

  return toKalshiMarketSnapshot(marketResponse, orderbookResponse)
}

export async function fetchCanonicalKalshiMarketState(
  marketTicker: string,
  client = new KalshiClient(),
): Promise<CanonicalMarketState> {
  return toCanonicalMarketState(await fetchKalshiMarketSnapshot(marketTicker, client))
}
