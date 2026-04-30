import { describe, expect, it } from 'vitest'

import { buildMarketEligibility } from './marketEligibility.js'
import type { FairMarketComparison } from './fairMarketComparison.js'

function comparison(overrides: Partial<FairMarketComparison> = {}): FairMarketComparison {
  return {
    available: true,
    marketTicker: 'KXATP-1-A',
    marketStatus: 'OPEN',
    marketYesSide: 'teamA',
    fairProbA: 0.6,
    fairProbB: 0.4,
    marketProbA: {
      bid: null,
      ask: 0.58,
      mid: null,
      last: 0.57,
    },
    marketProbB: {
      bid: null,
      ask: 0.43,
      mid: null,
      last: 0.43,
    },
    edgeA: {
      vsBid: null,
      vsAsk: 0.02,
      vsMid: null,
      vsLast: 0.03,
    },
    edgeB: {
      vsBid: null,
      vsAsk: -0.03,
      vsMid: null,
      vsLast: -0.03,
    },
    ...overrides,
  }
}

describe('buildMarketEligibility', () => {
  it('marks liquid open markets as eligible', () => {
    const result = buildMarketEligibility({
      marketState: {
        provider: 'kalshi',
        eventTicker: 'KXATP-1',
        marketTicker: 'KXATP-1-A',
        marketTitle: 'A vs B',
        marketStatus: 'OPEN',
        prices: {
          yesBid: null,
          yesAsk: 58,
          noBid: null,
          noAsk: 43,
          lastPrice: 57,
        },
        liquidity: {
          volume: 600000,
        },
        timestamps: {
          marketTimestamp: '2026-04-28T20:00:00Z',
        },
      },
      fairVsMarket: comparison(),
      capturedAt: '2026-04-28T20:00:08.000Z',
    })

    expect(result.eligible).toBe(true)
    expect(result.reasons).toEqual([])
    expect(result.metrics.provider).toBe('kalshi')
    expect(result.metrics.askOverround).toBeCloseTo(0.01, 6)
    expect(result.metrics.marketAgeSeconds).toBeCloseTo(8, 6)
  })

  it('explains why thin or malformed markets are not eligible', () => {
    const result = buildMarketEligibility({
      marketState: {
        provider: 'kalshi',
        eventTicker: 'KXATP-1',
        marketTicker: 'KXATP-1-A',
        marketTitle: 'A vs B',
        marketStatus: 'PAUSED',
        prices: {
          yesBid: null,
          yesAsk: 70,
          noBid: null,
          noAsk: null,
          lastPrice: null,
        },
        liquidity: {
          volume: 500,
        },
        timestamps: {
          marketTimestamp: '2026-04-28T20:00:00Z',
        },
      },
      fairVsMarket: comparison({
        available: false,
        marketStatus: 'PAUSED',
        marketProbA: { bid: null, ask: 0.7, mid: null, last: null },
        marketProbB: { bid: null, ask: null, mid: null, last: null },
      }),
      capturedAt: '2026-04-28T20:00:25.000Z',
    })

    expect(result.eligible).toBe(false)
    expect(result.reasons).toEqual([
      'market_not_open',
      'fair_comparison_unavailable',
      'missing_last_price',
      'missing_two_sided_ask',
      'low_volume',
      'missing_ask_overround',
      'stale_market_timestamp',
    ])
  })

  it('uses looser provider-aware thresholds for polymarket live markets', () => {
    const result = buildMarketEligibility({
      marketState: {
        provider: 'polymarket',
        eventTicker: 'wta-erjavec-lansere-2026-04-28',
        marketTicker: 'wta-erjavec-lansere-2026-04-28',
        marketTitle: 'Veronika Erjavec vs Sofya Lansere',
        marketStatus: 'OPEN',
        prices: {
          yesBid: 72,
          yesAsk: 73,
          noBid: 27,
          noAsk: 28,
          lastPrice: 70,
        },
        liquidity: {
          volume: 8342.70,
        },
        timestamps: {
          marketTimestamp: '2026-04-29T03:56:35.180818Z',
        },
      },
      fairVsMarket: comparison({
        marketTicker: 'wta-erjavec-lansere-2026-04-28',
        marketProbA: { bid: 0.72, ask: 0.73, mid: 0.725, last: 0.7 },
        marketProbB: { bid: 0.27, ask: 0.28, mid: 0.275, last: 0.3 },
      }),
      capturedAt: '2026-04-29T04:02:23.167Z',
    })

    expect(result.eligible).toBe(true)
    expect(result.reasons).toEqual([])
    expect(result.rule.provider).toBe('polymarket')
    expect(result.rule.minVolume).toBe(5000)
    expect(result.rule.maxMarketAgeSeconds).toBe(600)
  })
})
