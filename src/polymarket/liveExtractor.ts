import { buildCanonicalMarketState, type CanonicalMarketState, type MarketStatus } from '../foundation/canonicalMarketState.js'

interface PolymarketSportsPageData {
  id?: string | number | null
  ticker?: string | null
  slug?: string | null
  title?: string | null
  active?: boolean | null
  closed?: boolean | null
  volume?: string | number | null
  updatedAt?: string | null
  markets?: PolymarketSportsMarket[] | null
}

interface PolymarketSportsMarket {
  id?: string | number | null
  question?: string | null
  slug?: string | null
  sportsMarketType?: string | null
  outcomes?: string[] | null
  outcomePrices?: string[] | null
  active?: boolean | null
  closed?: boolean | null
  acceptingOrders?: boolean | null
  volume?: string | number | null
  updatedAt?: string | null
  bestBid?: string | number | null
  bestAsk?: string | number | null
  lastTradePrice?: string | number | null
  teams?: Array<{ name?: string | null }> | null
}

function normalize(value: string | null | undefined): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function compact(value: string | null | undefined): string {
  return normalize(value).replace(/\s+/g, '')
}

function parseNextDataFromHtml(html: string): unknown | null {
  const match = html.match(/<script id="__NEXT_DATA__" type="application\/json" crossorigin="anonymous">([\s\S]*?)<\/script>/i)
  if (!match) return null

  try {
    return JSON.parse(match[1] || 'null')
  } catch {
    return null
  }
}

function toNumber(value: string | number | null | undefined): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  const parsed = Number(String(value || '').trim())
  return Number.isFinite(parsed) ? parsed : null
}

function probToCents(value: number | null): number | null {
  if (value == null) return null
  return Math.round(value * 100)
}

function normalizeStatus(page: PolymarketSportsPageData, market: PolymarketSportsMarket): MarketStatus {
  if (market.closed || page.closed) return 'CLOSED'
  if (market.acceptingOrders || market.active || page.active) return 'OPEN'
  return 'UNKNOWN'
}

function selectMoneylineMarket(markets: PolymarketSportsMarket[], pageTitle: string | null): PolymarketSportsMarket | null {
  const normalizedPageTitle = compact(pageTitle)

  for (const market of markets) {
    if (String(market.sportsMarketType || '').toLowerCase() === 'moneyline') {
      return market
    }
  }

  for (const market of markets) {
    if (compact(market.slug) === compact(pageTitle)) {
      return market
    }
    if (compact(market.question) === normalizedPageTitle) {
      return market
    }
  }

  return markets[0] || null
}

function resolveDisplayTitle(market: PolymarketSportsMarket): string | null {
  const teams = Array.isArray(market.teams) ? market.teams : []
  const teamNames = teams.map((team) => String(team?.name || '').trim()).filter(Boolean)
  if (teamNames.length >= 2) {
    return `${teamNames[0]} vs ${teamNames[1]}`
  }

  const outcomes = Array.isArray(market.outcomes) ? market.outcomes.map((value) => String(value || '').trim()).filter(Boolean) : []
  if (outcomes.length >= 2) {
    return `${outcomes[0]} vs ${outcomes[1]}`
  }

  return market.question ? String(market.question).trim() : null
}

function deriveComplementaryPrice(primary: number | null): number | null {
  if (primary == null) return null
  return Math.round((1 - primary) * 100)
}

export function parseCanonicalPolymarketMarketStateFromHtml(html: string): CanonicalMarketState | null {
  const payload = parseNextDataFromHtml(html) as
    | {
        props?: {
          pageProps?: {
            sportsEvent?: PolymarketSportsPageData | null
          }
        }
      }
    | null

  const page = payload?.props?.pageProps?.sportsEvent || null
  const markets = Array.isArray(page?.markets) ? page.markets : []
  const market = selectMoneylineMarket(markets, page?.title || page?.slug || null)
  if (!page || !market) return null

  const bestBid = toNumber(market.bestBid)
  const bestAsk = toNumber(market.bestAsk)
  const lastTradePrice = toNumber(market.lastTradePrice)
  const volume = toNumber(market.volume ?? page.volume)
  const marketTimestamp = market.updatedAt || page.updatedAt || new Date().toISOString()

  return buildCanonicalMarketState({
    provider: 'polymarket',
    eventTicker: String(page.ticker || page.slug || page.id || '').trim() || null,
    marketTicker: String(market.slug || market.id || '').trim() || null,
    marketTitle: resolveDisplayTitle(market),
    marketStatus: normalizeStatus(page, market),
    yesBid: probToCents(bestBid),
    yesAsk: probToCents(bestAsk),
    noBid: deriveComplementaryPrice(bestAsk),
    noAsk: deriveComplementaryPrice(bestBid),
    lastPrice: probToCents(lastTradePrice),
    volume,
    marketTimestamp,
  })
}

export async function extractCanonicalPolymarketMarketStateFromPage(marketUrl: string): Promise<CanonicalMarketState | null> {
  const response = await fetch(marketUrl, {
    headers: {
      'user-agent': 'Mozilla/5.0',
    },
  })
  if (!response.ok) {
    throw new Error(`Polymarket request failed with ${response.status}`)
  }

  const html = await response.text()
  return parseCanonicalPolymarketMarketStateFromHtml(html)
}
