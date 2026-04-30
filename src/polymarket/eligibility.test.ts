import { describe, expect, it, vi } from 'vitest'

import {
  buildPolymarketEligibilityReport,
  DEFAULT_POLYMARKET_ELIGIBILITY_RULE,
  evaluatePolymarketEligibility,
} from './eligibility.js'
import type { PolymarketMatchWinnerPriceSummary } from './types.js'

function summary(overrides: Partial<PolymarketMatchWinnerPriceSummary> = {}): PolymarketMatchWinnerPriceSummary {
  return {
    source: 'polymarket',
    marketId: 'm1',
    conditionId: 'c1',
    eventId: 'e1',
    question: 'Player A vs Player B',
    eventTitle: 'Event',
    marketKind: 'match_winner',
    competitionHint: 'ATP/ITF men',
    playerA: 'Player A',
    playerB: 'Player B',
    winner: 'token1',
    outcomePrices: [1, 0],
    finalToken1Price: 1,
    finalToken2Price: 0,
    closed: true,
    active: false,
    archived: false,
    marketVolume: 1000,
    createdAt: null,
    endDate: null,
    priceSemantics: 'reported_trade_price_not_player_mapped',
    tradeCount: 50,
    buyTradeCount: 25,
    sellTradeCount: 25,
    unknownSideTradeCount: 0,
    firstTradeTimestamp: 100,
    lastTradeTimestamp: 200,
    firstTradePrice: 0.2,
    lastTradePrice: 0.8,
    minTradePrice: 0.2,
    maxTradePrice: 0.8,
    simpleAverageTradePrice: 0.5,
    usdVwapTradePrice: 0.55,
    usdVolume: 5000,
    tokenVolume: 10000,
    priceMove: 0.6,
    ...overrides,
  }
}

describe('polymarket eligibility', () => {
  it('flags thin or unresolved markets as ineligible', () => {
    expect(evaluatePolymarketEligibility(summary(), DEFAULT_POLYMARKET_ELIGIBILITY_RULE)).toEqual({
      eligible: true,
      reasons: [],
    })
    expect(
      evaluatePolymarketEligibility(summary({ usdVolume: 999, tradeCount: 19, winner: 'unknown' }), DEFAULT_POLYMARKET_ELIGIBILITY_RULE),
    ).toEqual({
      eligible: false,
      reasons: ['unsettled', 'low_usd_volume', 'low_trade_count'],
    })
  })

  it('builds an eligibility report with reason buckets', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-28T22:00:00.000Z'))

    const report = buildPolymarketEligibilityReport([
      summary(),
      summary({ marketId: 'm2', competitionHint: 'WTA/ITF women', usdVolume: 100, tradeCount: 50 }),
      summary({ marketId: 'm3', winner: 'unknown', usdVolume: 5000, tradeCount: 50 }),
    ], { inputPath: 'price-series.jsonl' })

    expect(report).toMatchObject({
      version: 'polymarket-eligibility-report/v1',
      generatedAt: '2026-04-28T22:00:00.000Z',
      inputPath: 'price-series.jsonl',
      overall: {
        marketCount: 3,
        eligibleCount: 1,
        eligibilityRate: 0.3333,
      },
    })
    expect(report.byCompetitionHint).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'ATP/ITF men', marketCount: 2, eligibleCount: 1 }),
      expect.objectContaining({ key: 'WTA/ITF women', marketCount: 1, eligibleCount: 0 }),
    ]))
    expect(report.byReason).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'eligible', marketCount: 1 }),
      expect.objectContaining({ key: 'low_usd_volume', marketCount: 1 }),
      expect.objectContaining({ key: 'unsettled', marketCount: 1 }),
    ]))
    expect(report.eligibleTopByUsdVolume[0]).toMatchObject({ marketId: 'm1', usdVolume: 5000, tradeCount: 50 })

    vi.useRealTimers()
  })
})
