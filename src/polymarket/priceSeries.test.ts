import { describe, expect, it } from 'vitest'

import {
  buildPolymarketMatchWinnerSummaryMap,
  finalizePolymarketMatchWinnerSummaries,
  updatePolymarketMatchWinnerSummary,
} from './priceSeries.js'
import type { NormalizedPolymarketMarket, NormalizedPolymarketTrade } from './types.js'

function market(overrides: Partial<NormalizedPolymarketMarket> = {}): NormalizedPolymarketMarket {
  return {
    source: 'polymarket',
    id: 'm1',
    conditionId: 'c1',
    eventId: 'e1',
    question: 'ATP: Player A vs Player B',
    slug: null,
    eventTitle: 'ATP: Player A vs Player B',
    eventSlug: null,
    answer1: null,
    answer2: null,
    token1: null,
    token2: null,
    closed: true,
    active: false,
    archived: false,
    outcomePrices: [1, 0],
    winner: 'token1',
    volume: 1000,
    createdAt: null,
    endDate: null,
    sport: 'tennis',
    marketKind: 'match_winner',
    competitionHint: 'ATP/ITF men',
    playerA: 'Player A',
    playerB: 'Player B',
    ...overrides,
  }
}

function trade(overrides: Partial<NormalizedPolymarketTrade> = {}): NormalizedPolymarketTrade {
  return {
    source: 'polymarket',
    timestamp: 100,
    marketId: 'm1',
    conditionId: 'c1',
    eventId: 'e1',
    price: 0.4,
    usdAmount: 10,
    tokenAmount: 25,
    side: 'BUY',
    tokenSide: 'unknown',
    transactionHash: null,
    logIndex: null,
    ...overrides,
  }
}

describe('polymarket match winner price series aggregation', () => {
  it('aggregates trade prices, volume, and first/last values by market', () => {
    const summaries = buildPolymarketMatchWinnerSummaryMap([market()])
    updatePolymarketMatchWinnerSummary(summaries, trade({ timestamp: 200, price: 0.7, usdAmount: 30, side: 'SELL' }))
    updatePolymarketMatchWinnerSummary(summaries, trade({ timestamp: 100, price: 0.4, usdAmount: 10, side: 'BUY' }))
    updatePolymarketMatchWinnerSummary(summaries, trade({ timestamp: 300, price: 0.9, usdAmount: 60, side: 'BUY' }))

    expect(finalizePolymarketMatchWinnerSummaries(summaries)[0]).toMatchObject({
      marketId: 'm1',
      tradeCount: 3,
      buyTradeCount: 2,
      sellTradeCount: 1,
      firstTradeTimestamp: 100,
      lastTradeTimestamp: 300,
      firstTradePrice: 0.4,
      lastTradePrice: 0.9,
      minTradePrice: 0.4,
      maxTradePrice: 0.9,
      simpleAverageTradePrice: 0.66666667,
      usdVwapTradePrice: 0.79,
      usdVolume: 100,
      priceMove: 0.5,
      priceSemantics: 'reported_trade_price_not_player_mapped',
    })
  })

  it('keeps zero-trade markets so coverage gaps are visible', () => {
    const summaries = buildPolymarketMatchWinnerSummaryMap([market({ id: 'm2' })])

    expect(finalizePolymarketMatchWinnerSummaries(summaries)[0]).toMatchObject({
      marketId: 'm2',
      tradeCount: 0,
      firstTradePrice: null,
      lastTradePrice: null,
    })
  })
})
