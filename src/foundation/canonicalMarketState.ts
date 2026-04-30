export type MarketStatus = 'OPEN' | 'PAUSED' | 'SETTLED' | 'CLOSED' | 'UNKNOWN'
export type MarketProvider = 'kalshi' | 'polymarket' | 'unknown'

export interface CanonicalMarketState {
  provider: MarketProvider
  eventTicker: string | null
  marketTicker: string | null
  marketTitle: string | null
  marketStatus: MarketStatus
  prices: {
    yesBid: number | null
    yesAsk: number | null
    noBid: number | null
    noAsk: number | null
    lastPrice: number | null
  }
  liquidity: {
    volume: number | null
  }
  timestamps: {
    marketTimestamp: string | null
  }
}

export function buildCanonicalMarketState(input: {
  provider?: MarketProvider | null
  eventTicker?: string | null
  marketTicker?: string | null
  marketTitle?: string | null
  marketStatus?: MarketStatus | null
  yesBid?: number | null
  yesAsk?: number | null
  noBid?: number | null
  noAsk?: number | null
  lastPrice?: number | null
  volume?: number | null
  marketTimestamp?: string | null
}): CanonicalMarketState {
  return {
    provider: input.provider ?? 'unknown',
    eventTicker: input.eventTicker ?? null,
    marketTicker: input.marketTicker ?? null,
    marketTitle: input.marketTitle ?? null,
    marketStatus: input.marketStatus ?? 'UNKNOWN',
    prices: {
      yesBid: input.yesBid ?? null,
      yesAsk: input.yesAsk ?? null,
      noBid: input.noBid ?? null,
      noAsk: input.noAsk ?? null,
      lastPrice: input.lastPrice ?? null,
    },
    liquidity: {
      volume: input.volume ?? null,
    },
    timestamps: {
      marketTimestamp: input.marketTimestamp ?? null,
    },
  }
}
