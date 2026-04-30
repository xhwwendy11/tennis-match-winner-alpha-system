import { describe, expect, it } from 'vitest'

import { parseCanonicalPolymarketMarketStateFromHtml } from './liveExtractor.js'

function buildHtmlWithNextData(data: unknown): string {
  return `<!doctype html><html><body><script id="__NEXT_DATA__" type="application/json" crossorigin="anonymous">${JSON.stringify(data)}</script></body></html>`
}

describe('parseCanonicalPolymarketMarketStateFromHtml', () => {
  it('extracts the moneyline market and maps probabilities into canonical prices', () => {
    const html = buildHtmlWithNextData({
      props: {
        pageProps: {
          sportsEvent: {
            id: 'event-1',
            ticker: 'wta-erjavec-lansere-2026-04-28',
            slug: 'wta-erjavec-lansere-2026-04-28',
            title: 'Huzhou: Veronika Erjavec vs Sofya Lansere',
            active: true,
            closed: false,
            volume: '3696',
            updatedAt: '2026-04-29T03:52:16.477892Z',
            markets: [
              {
                id: 'market-1',
                question: 'Huzhou: Veronika Erjavec vs Sofya Lansere',
                slug: 'wta-erjavec-lansere-2026-04-28',
                sportsMarketType: 'moneyline',
                outcomes: ['Veronika Erjavec', 'Sofya Lansere'],
                outcomePrices: ['0.665', '0.335'],
                active: true,
                closed: false,
                acceptingOrders: true,
                volume: '5453.086850999999',
                updatedAt: '2026-04-29T03:52:16.477892Z',
                bestBid: 0.66,
                bestAsk: 0.67,
                lastTradePrice: 0.68,
                teams: [{ name: 'Veronika Erjavec' }, { name: 'Sofya Lansere' }],
              },
              {
                id: 'market-2',
                question: 'Set 1 Winner: Erjavec vs Lansere',
                slug: 'wta-erjavec-lansere-2026-04-28-first-set-winner',
                sportsMarketType: 'set_1_winner',
              },
            ],
          },
        },
      },
    })

    expect(parseCanonicalPolymarketMarketStateFromHtml(html)).toEqual({
      provider: 'polymarket',
      eventTicker: 'wta-erjavec-lansere-2026-04-28',
      marketTicker: 'wta-erjavec-lansere-2026-04-28',
      marketTitle: 'Veronika Erjavec vs Sofya Lansere',
      marketStatus: 'OPEN',
      prices: {
        yesBid: 66,
        yesAsk: 67,
        noBid: 33,
        noAsk: 34,
        lastPrice: 68,
      },
      liquidity: {
        volume: 5453.086850999999,
      },
      timestamps: {
        marketTimestamp: '2026-04-29T03:52:16.477892Z',
      },
    })
  })

  it('returns null when next data is missing', () => {
    expect(parseCanonicalPolymarketMarketStateFromHtml('<html></html>')).toBeNull()
  })
})
