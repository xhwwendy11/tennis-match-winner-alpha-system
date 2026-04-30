import { describe, expect, it } from 'vitest'

import { buildKalshiMarketSnapshot } from './marketSnapshot.js'

describe('buildKalshiMarketSnapshot', () => {
  it('records Kalshi market prices with derived mid and spread fields', () => {
    const snapshot = buildKalshiMarketSnapshot({
      capturedAt: '2026-04-20T20:00:00.000Z',
      sourceUrl: 'https://kalshi.com/markets/example',
      marketState: {
        eventTicker: 'KXATP-123',
        marketTicker: 'KXATP-123-A',
        marketTitle: 'A vs B',
        marketStatus: 'OPEN',
        prices: {
          yesBid: 57,
          yesAsk: 59,
          noBid: 41,
          noAsk: 43,
          lastPrice: 58,
        },
        liquidity: {
          volume: 150000,
        },
        timestamps: {
          marketTimestamp: '2026-04-20T19:59:59.000Z',
        },
      },
      orderbook: {
        yes: [{ price: 57, size: 120 }],
        no: [{ price: 41, size: 75 }],
      },
      trades: {
        items: [
          {
            tradeId: 'trade-1',
            ticker: 'KXATP-123-A',
            count: 10,
            yesPrice: 58,
            noPrice: 42,
            takerSide: 'yes',
            createdTime: '2026-04-20T19:59:58.000Z',
          },
        ],
        cursor: 'next-cursor',
      },
    })

    expect(snapshot.version).toBe('kalshi-market-snapshot/v1')
    expect(snapshot.marketTicker).toBe('KXATP-123-A')
    expect(snapshot.prices.yesMid).toBeCloseTo(0.58, 6)
    expect(snapshot.prices.noMid).toBeCloseTo(0.42, 6)
    expect(snapshot.prices.spread).toBeCloseTo(0.02, 6)
    expect(snapshot.orderbook.yes).toEqual([{ price: 57, size: 120 }])
    expect(snapshot.trades.items).toHaveLength(1)
    expect(snapshot.trades.cursor).toBe('next-cursor')
  })
})
