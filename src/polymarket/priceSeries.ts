import type {
  NormalizedPolymarketMarket,
  NormalizedPolymarketTrade,
  PolymarketMatchWinnerPriceSummary,
} from './types.js'

interface MutableSummary extends PolymarketMatchWinnerPriceSummary {
  priceSum: number
  priceCount: number
  usdWeightedPriceSum: number
}

function baseSummary(market: NormalizedPolymarketMarket): MutableSummary | null {
  if (!market.id || market.marketKind !== 'match_winner') return null
  const [finalToken1Price, finalToken2Price] = market.outcomePrices || [null, null]
  return {
    source: 'polymarket',
    marketId: market.id,
    conditionId: market.conditionId,
    eventId: market.eventId,
    question: market.question,
    eventTitle: market.eventTitle,
    marketKind: 'match_winner',
    competitionHint: market.competitionHint,
    playerA: market.playerA,
    playerB: market.playerB,
    winner: market.winner,
    outcomePrices: market.outcomePrices,
    finalToken1Price,
    finalToken2Price,
    closed: market.closed,
    active: market.active,
    archived: market.archived,
    marketVolume: market.volume,
    createdAt: market.createdAt,
    endDate: market.endDate,
    priceSemantics: 'reported_trade_price_not_player_mapped',
    tradeCount: 0,
    buyTradeCount: 0,
    sellTradeCount: 0,
    unknownSideTradeCount: 0,
    firstTradeTimestamp: null,
    lastTradeTimestamp: null,
    firstTradePrice: null,
    lastTradePrice: null,
    minTradePrice: null,
    maxTradePrice: null,
    simpleAverageTradePrice: null,
    usdVwapTradePrice: null,
    usdVolume: 0,
    tokenVolume: 0,
    priceMove: null,
    priceSum: 0,
    priceCount: 0,
    usdWeightedPriceSum: 0,
  }
}

function round(value: number | null, decimals = 8): number | null {
  if (value == null || !Number.isFinite(value)) return null
  const scale = 10 ** decimals
  return Math.round(value * scale) / scale
}

export function buildPolymarketMatchWinnerSummaryMap(
  markets: NormalizedPolymarketMarket[],
): Map<string, PolymarketMatchWinnerPriceSummary> {
  const summaries = new Map<string, MutableSummary>()
  for (const market of markets) {
    const summary = baseSummary(market)
    if (summary) summaries.set(summary.marketId, summary)
  }
  return summaries as Map<string, PolymarketMatchWinnerPriceSummary>
}

export function updatePolymarketMatchWinnerSummary(
  summaries: Map<string, PolymarketMatchWinnerPriceSummary>,
  trade: NormalizedPolymarketTrade,
): void {
  if (!trade.marketId) return
  const summary = summaries.get(trade.marketId) as MutableSummary | undefined
  if (!summary) return

  summary.tradeCount += 1
  if (trade.side === 'BUY') summary.buyTradeCount += 1
  else if (trade.side === 'SELL') summary.sellTradeCount += 1
  else summary.unknownSideTradeCount += 1

  const usdAmount = trade.usdAmount || 0
  const tokenAmount = trade.tokenAmount || 0
  summary.usdVolume += usdAmount
  summary.tokenVolume += tokenAmount

  if (trade.price != null) {
    summary.priceSum += trade.price
    summary.priceCount += 1
    if (usdAmount > 0) summary.usdWeightedPriceSum += trade.price * usdAmount
    summary.minTradePrice = summary.minTradePrice == null ? trade.price : Math.min(summary.minTradePrice, trade.price)
    summary.maxTradePrice = summary.maxTradePrice == null ? trade.price : Math.max(summary.maxTradePrice, trade.price)
  }

  if (trade.timestamp != null) {
    if (summary.firstTradeTimestamp == null || trade.timestamp < summary.firstTradeTimestamp) {
      summary.firstTradeTimestamp = trade.timestamp
      summary.firstTradePrice = trade.price
    }
    if (summary.lastTradeTimestamp == null || trade.timestamp >= summary.lastTradeTimestamp) {
      summary.lastTradeTimestamp = trade.timestamp
      summary.lastTradePrice = trade.price
    }
  } else if (summary.firstTradePrice == null) {
    summary.firstTradePrice = trade.price
    summary.lastTradePrice = trade.price
  }
}

export function finalizePolymarketMatchWinnerSummary(
  summary: PolymarketMatchWinnerPriceSummary,
): PolymarketMatchWinnerPriceSummary {
  const mutable = summary as MutableSummary
  const simpleAverageTradePrice = mutable.priceCount > 0 ? mutable.priceSum / mutable.priceCount : null
  const usdVwapTradePrice = mutable.usdVolume > 0 ? mutable.usdWeightedPriceSum / mutable.usdVolume : null
  const priceMove = summary.firstTradePrice != null && summary.lastTradePrice != null
    ? summary.lastTradePrice - summary.firstTradePrice
    : null
  const {
    priceSum: _priceSum,
    priceCount: _priceCount,
    usdWeightedPriceSum: _usdWeightedPriceSum,
    ...publicSummary
  } = mutable

  return {
    ...publicSummary,
    simpleAverageTradePrice: round(simpleAverageTradePrice),
    usdVwapTradePrice: round(usdVwapTradePrice),
    usdVolume: round(summary.usdVolume, 4) || 0,
    tokenVolume: round(summary.tokenVolume, 4) || 0,
    firstTradePrice: round(summary.firstTradePrice),
    lastTradePrice: round(summary.lastTradePrice),
    minTradePrice: round(summary.minTradePrice),
    maxTradePrice: round(summary.maxTradePrice),
    priceMove: round(priceMove),
  }
}

export function finalizePolymarketMatchWinnerSummaries(
  summaries: Map<string, PolymarketMatchWinnerPriceSummary>,
): PolymarketMatchWinnerPriceSummary[] {
  return [...summaries.values()].map(finalizePolymarketMatchWinnerSummary)
}
