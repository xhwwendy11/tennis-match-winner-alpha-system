import { describe, expect, it, vi } from 'vitest'

import { buildPolymarketHistoryReport } from './historyReport.js'
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
    tradeCount: 10,
    buyTradeCount: 6,
    sellTradeCount: 4,
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

describe('buildPolymarketHistoryReport', () => {
  it('summarizes markets by competition, volume, and volatility buckets', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-28T21:00:00.000Z'))

    const report = buildPolymarketHistoryReport([
      summary(),
      summary({
        marketId: 'm2',
        competitionHint: 'WTA/ITF women',
        tradeCount: 0,
        usdVolume: 0,
        priceMove: null,
        winner: 'unknown',
      }),
      summary({
        marketId: 'm3',
        tradeCount: 100,
        usdVolume: 125000,
        priceMove: -0.05,
      }),
    ], { inputPath: 'price-series.jsonl' })

    expect(report).toMatchObject({
      version: 'polymarket-history-report/v1',
      generatedAt: '2026-04-28T21:00:00.000Z',
      inputPath: 'price-series.jsonl',
      priceSemantics: 'reported_trade_price_not_player_mapped',
      overall: {
        marketCount: 3,
        tradedMarketCount: 2,
        settledMarketCount: 2,
        usdVolumeSum: 130000,
        tradeCountSum: 110,
      },
    })

    expect(report.byCompetitionHint).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'ATP/ITF men', marketCount: 2 }),
      expect.objectContaining({ key: 'WTA/ITF women', marketCount: 1 }),
    ]))
    expect(report.byUsdVolumeBucket).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: '1k-10k', marketCount: 1 }),
      expect.objectContaining({ key: '100k+', marketCount: 1 }),
      expect.objectContaining({ key: '0', marketCount: 1 }),
    ]))
    expect(report.byAbsPriceMoveBucket).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: '0.50+', marketCount: 1 }),
      expect.objectContaining({ key: '0-0.10', marketCount: 1 }),
      expect.objectContaining({ key: '0', marketCount: 1 }),
    ]))
    expect(report.topByUsdVolume[0]).toMatchObject({ marketId: 'm3', usdVolume: 125000 })
    expect(report.topByTradeCount[0]).toMatchObject({ marketId: 'm3', tradeCount: 100 })
    expect(report.topByAbsPriceMove[0]).toMatchObject({ marketId: 'm1', absPriceMove: 0.6 })

    vi.useRealTimers()
  })
})
