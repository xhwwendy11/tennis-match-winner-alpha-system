export interface RawPolymarketMarketRow {
  id?: string | null
  question?: string | null
  slug?: string | null
  condition_id?: string | null
  token1?: string | null
  token2?: string | null
  answer1?: string | null
  answer2?: string | null
  closed?: number | boolean | string | null
  active?: number | boolean | string | null
  archived?: number | boolean | string | null
  outcome_prices?: string | string[] | number[] | null
  volume?: number | string | null
  event_id?: string | null
  event_slug?: string | null
  event_title?: string | null
  created_at?: string | null
  end_date?: string | null
}

export interface RawPolymarketTradeRow {
  timestamp?: number | string | null
  market_id?: string | null
  condition_id?: string | null
  event_id?: string | null
  price?: number | string | null
  usd_amount?: number | string | null
  token_amount?: number | string | null
  side?: string | null
  nonusdc_side?: string | null
  transaction_hash?: string | null
  log_index?: number | string | null
}

export type PolymarketOutcomeWinner = 'token1' | 'token2' | 'unknown'
export type PolymarketTennisMarketKind = 'match_winner' | 'outright' | 'handicap' | 'total' | 'other'

export interface NormalizedPolymarketMarket {
  source: 'polymarket'
  id: string | null
  conditionId: string | null
  eventId: string | null
  question: string | null
  slug: string | null
  eventTitle: string | null
  eventSlug: string | null
  answer1: string | null
  answer2: string | null
  token1: string | null
  token2: string | null
  closed: boolean
  active: boolean
  archived: boolean
  outcomePrices: [number, number] | null
  winner: PolymarketOutcomeWinner
  volume: number | null
  createdAt: string | null
  endDate: string | null
  sport: 'tennis' | 'unknown'
  marketKind: PolymarketTennisMarketKind
  competitionHint: string | null
  playerA: string | null
  playerB: string | null
}

export interface NormalizedPolymarketTrade {
  source: 'polymarket'
  timestamp: number | null
  marketId: string | null
  conditionId: string | null
  eventId: string | null
  price: number | null
  usdAmount: number | null
  tokenAmount: number | null
  side: 'BUY' | 'SELL' | 'unknown'
  tokenSide: 'token1' | 'token2' | 'unknown'
  transactionHash: string | null
  logIndex: number | null
}

export interface PolymarketMatchWinnerPriceSummary {
  source: 'polymarket'
  marketId: string
  conditionId: string | null
  eventId: string | null
  question: string | null
  eventTitle: string | null
  marketKind: 'match_winner'
  competitionHint: string | null
  playerA: string | null
  playerB: string | null
  winner: PolymarketOutcomeWinner
  outcomePrices: [number, number] | null
  finalToken1Price: number | null
  finalToken2Price: number | null
  closed: boolean
  active: boolean
  archived: boolean
  marketVolume: number | null
  createdAt: string | null
  endDate: string | null
  priceSemantics: 'reported_trade_price_not_player_mapped'
  tradeCount: number
  buyTradeCount: number
  sellTradeCount: number
  unknownSideTradeCount: number
  firstTradeTimestamp: number | null
  lastTradeTimestamp: number | null
  firstTradePrice: number | null
  lastTradePrice: number | null
  minTradePrice: number | null
  maxTradePrice: number | null
  simpleAverageTradePrice: number | null
  usdVwapTradePrice: number | null
  usdVolume: number
  tokenVolume: number
  priceMove: number | null
}
