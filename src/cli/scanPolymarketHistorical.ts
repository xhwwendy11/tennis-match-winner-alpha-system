import { readLocalJsonLines, readLocalTable } from '../polymarket/localFiles.js'
import {
  filterPolymarketTennisMarkets,
  normalizePolymarketTrade,
} from '../polymarket/historicalData.js'
import type { RawPolymarketMarketRow, RawPolymarketTradeRow } from '../polymarket/types.js'

function usage(): never {
  console.error('Usage: tsx src/cli/scanPolymarketHistorical.ts --markets markets.jsonl|csv|json [--trades quant.jsonl|csv|json] [--limit n]')
  process.exit(1)
}

function flag(argv: string[], name: string): string | null {
  const index = argv.indexOf(name)
  return index >= 0 ? argv[index + 1] || null : null
}

function parseLimit(value: string | null): number | null {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

function asObjects(rows: unknown[]): Record<string, unknown>[] {
  return rows.filter((row): row is Record<string, unknown> => !!row && typeof row === 'object' && !Array.isArray(row))
}

export async function main(argv = process.argv): Promise<void> {
  const marketsPath = flag(argv, '--markets')
  if (!marketsPath) usage()

  const tradesPath = flag(argv, '--trades')
  const limit = parseLimit(flag(argv, '--limit'))
  const marketRows = asObjects(await readLocalTable(marketsPath)) as RawPolymarketMarketRow[]
  const tennisMarkets = filterPolymarketTennisMarkets(limit ? marketRows.slice(0, limit) : marketRows)
  const settledMarkets = tennisMarkets.filter((market) => market.winner !== 'unknown')
  const matchWinnerMarkets = tennisMarkets.filter((market) => market.marketKind === 'match_winner')
  const settledMatchWinnerMarkets = matchWinnerMarkets.filter((market) => market.winner !== 'unknown')
  const marketIds = new Set(tennisMarkets.map((market) => market.id).filter((id): id is string => !!id))

  let tradeRows = 0
  let tennisTradeRows = 0
  let tennisTradeUsdAmount = 0
  if (tradesPath) {
    const lower = tradesPath.toLowerCase()
    const tradeSource = lower.endsWith('.jsonl') || lower.endsWith('.ndjson')
      ? readLocalJsonLines(tradesPath)
      : (async function* () {
          for (const row of await readLocalTable(tradesPath)) yield row
        })()

    for await (const rawRow of tradeSource) {
      const row = rawRow && typeof rawRow === 'object' && !Array.isArray(rawRow)
        ? rawRow as RawPolymarketTradeRow
        : null
      if (!row) continue
      tradeRows += 1
      if (limit && tradeRows > limit) break
      const trade = normalizePolymarketTrade(row)
      if (trade.marketId && marketIds.has(trade.marketId)) {
        tennisTradeRows += 1
        tennisTradeUsdAmount += trade.usdAmount || 0
      }
    }
  }

  const summary = {
    ok: true,
    marketsPath,
    tradesPath,
    scannedMarketRows: limit ? Math.min(limit, marketRows.length) : marketRows.length,
    tennisMarketCount: tennisMarkets.length,
    settledTennisMarketCount: settledMarkets.length,
    matchWinnerMarketCount: matchWinnerMarkets.length,
    settledMatchWinnerMarketCount: settledMatchWinnerMarkets.length,
    tennisMarketsWithPlayers: tennisMarkets.filter((market) => market.playerA && market.playerB).length,
    matchWinnerMarketsWithPlayers: matchWinnerMarkets.filter((market) => market.playerA && market.playerB).length,
    marketKindCounts: tennisMarkets.reduce<Record<string, number>>((acc, market) => {
      acc[market.marketKind] = (acc[market.marketKind] || 0) + 1
      return acc
    }, {}),
    topTennisMarketsByVolume: [...tennisMarkets]
      .sort((a, b) => (b.volume || 0) - (a.volume || 0))
      .slice(0, 20)
      .map((market) => ({
        id: market.id,
        question: market.question,
        eventTitle: market.eventTitle,
        volume: market.volume,
        winner: market.winner,
        marketKind: market.marketKind,
        playerA: market.playerA,
        playerB: market.playerB,
        endDate: market.endDate,
      })),
    tradeRows,
    tennisTradeRows,
    tennisTradeUsdAmount,
  }

  console.log(JSON.stringify(summary, null, 2))
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(JSON.stringify({ ok: false, error: message }, null, 2))
  process.exit(1)
})
