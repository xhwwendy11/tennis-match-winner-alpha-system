import { describe, expect, it } from 'vitest'

import { normalizeKalshiTrades, toCanonicalMarketState, toKalshiMarketSnapshot } from './marketClient.js'

describe('toKalshiMarketSnapshot', () => {
  it('maps market and orderbook payloads into a normalized snapshot', () => {
    const snapshot = toKalshiMarketSnapshot(
      {
        market: {
          ticker: 'KXMEDVBER-YES',
          event_ticker: 'KXMEDVBER',
          title: 'Medvedev vs Berrettini',
          status: 'open',
          last_price: 92,
          volume: 699910,
          yes_ask: 93,
          no_ask: 9,
          updated_at: '2026-04-11T12:00:00Z',
        },
      },
      {
        orderbook: {
          yes: [
            [91, 120],
            [90, 80],
          ],
          no: [[8, 75]],
        },
      },
    )

    expect(snapshot.marketStatus).toBe('OPEN')
    expect(snapshot.yesBid).toBe(91)
    expect(snapshot.yesAsk).toBe(93)
    expect(snapshot.noBid).toBe(8)
    expect(snapshot.noAsk).toBe(9)
    expect(snapshot.lastPrice).toBe(92)
    expect(snapshot.volume).toBe(699910)
    expect(snapshot.yesLevels).toEqual([
      { price: 91, size: 120 },
      { price: 90, size: 80 },
    ])
  })

  it('maps current fixed-point orderbook payloads into normalized levels', () => {
    const snapshot = toKalshiMarketSnapshot(
      {
        market: {
          ticker: 'KXMEDVBER-YES',
          event_ticker: 'KXMEDVBER',
          title: 'Medvedev vs Berrettini',
          status: 'open',
        },
      },
      {
        orderbook_fp: {
          yes_dollars: [
            ['0.91', '120.5'],
            ['0.90', '80'],
          ],
          no_dollars: [['0.08', '75']],
        },
      },
    )

    expect(snapshot.yesBid).toBe(0.91)
    expect(snapshot.noBid).toBe(0.08)
    expect(snapshot.yesLevels).toEqual([
      { price: 0.91, size: 120.5 },
      { price: 0.9, size: 80 },
    ])
    expect(snapshot.noLevels).toEqual([{ price: 0.08, size: 75 }])
  })

  it('maps current dollar price fields from market payloads', () => {
    const snapshot = toKalshiMarketSnapshot(
      {
        market: {
          ticker: 'KXITF-ZAR',
          event_ticker: 'KXITF',
          title: 'Will Renata Zarazua win?',
          status: 'finalized',
          last_price_dollars: '0.9900',
          yes_bid_dollars: '0.9900',
          yes_ask_dollars: '1.0000',
          no_bid_dollars: '0.0000',
          no_ask_dollars: '0.0100',
          volume_fp: '5479.82',
          updated_time: '2026-04-22T19:08:23.011957Z',
        },
      },
      {
        orderbook_fp: {
          yes_dollars: [],
          no_dollars: [],
        },
      },
    )

    expect(snapshot.marketStatus).toBe('SETTLED')
    expect(snapshot.yesBid).toBe(0.99)
    expect(snapshot.yesAsk).toBe(1)
    expect(snapshot.noBid).toBe(0)
    expect(snapshot.noAsk).toBe(0.01)
    expect(snapshot.lastPrice).toBe(0.99)
    expect(snapshot.volume).toBe(5479.82)
    expect(snapshot.marketTimestamp).toBe('2026-04-22T19:08:23.011957Z')
  })
})

describe('toCanonicalMarketState', () => {
  it('converts a normalized snapshot into canonical market state', () => {
    const canonical = toCanonicalMarketState({
      eventTicker: 'KXMEDVBER',
      marketTicker: 'KXMEDVBER-YES',
      marketTitle: 'Medvedev vs Berrettini',
      marketStatus: 'OPEN',
      yesBid: 91,
      yesAsk: 93,
      noBid: 8,
      noAsk: 9,
      lastPrice: 92,
      volume: 699910,
      marketTimestamp: '2026-04-11T12:00:00Z',
      yesLevels: [],
      noLevels: [],
    })

    expect(canonical).toEqual({
      provider: 'kalshi',
      eventTicker: 'KXMEDVBER',
      marketTicker: 'KXMEDVBER-YES',
      marketTitle: 'Medvedev vs Berrettini',
      marketStatus: 'OPEN',
      prices: {
        yesBid: 91,
        yesAsk: 93,
        noBid: 8,
        noAsk: 9,
        lastPrice: 92,
      },
      liquidity: {
        volume: 699910,
      },
      timestamps: {
        marketTimestamp: '2026-04-11T12:00:00Z',
      },
    })
  })
})

describe('normalizeKalshiTrades', () => {
  it('maps Kalshi trades payloads into normalized trade rows', () => {
    const snapshot = normalizeKalshiTrades({
      cursor: 'next',
      trades: [
        {
          trade_id: 'trade-1',
          ticker: 'KXMEDVBER-YES',
          count_fp: '10.5',
          yes_price_dollars: '0.5800',
          no_price_dollars: '0.4200',
          taker_side: 'yes',
          created_time: '2026-04-11T12:00:01Z',
        },
      ],
    })

    expect(snapshot.cursor).toBe('next')
    expect(snapshot.trades).toEqual([
      {
        tradeId: 'trade-1',
        ticker: 'KXMEDVBER-YES',
        count: 10.5,
        yesPrice: 0.58,
        noPrice: 0.42,
        takerSide: 'yes',
        createdTime: '2026-04-11T12:00:01Z',
      },
    ])
  })
})
