import { createWriteStream } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import { once } from 'node:events'

import { readLocalJsonLines, readLocalTable } from '../polymarket/localFiles.js'
import { filterPolymarketTennisMarkets, normalizePolymarketTrade } from '../polymarket/historicalData.js'
import {
  buildPolymarketMatchWinnerSummaryMap,
  finalizePolymarketMatchWinnerSummary,
  updatePolymarketMatchWinnerSummary,
} from '../polymarket/priceSeries.js'
import type { RawPolymarketMarketRow, RawPolymarketTradeRow } from '../polymarket/types.js'

function usage(): never {
  console.error('Usage: tsx src/cli/aggregatePolymarketPriceSeries.ts --markets markets.jsonl --trades quant.jsonl --out price-series.jsonl')
  process.exit(1)
}

function flag(argv: string[], name: string): string | null {
  const index = argv.indexOf(name)
  return index >= 0 ? argv[index + 1] || null : null
}

function asObjects(rows: unknown[]): Record<string, unknown>[] {
  return rows.filter((row): row is Record<string, unknown> => !!row && typeof row === 'object' && !Array.isArray(row))
}

function writeLine(stream: NodeJS.WritableStream, value: unknown): Promise<void> | null {
  const ok = stream.write(`${JSON.stringify(value)}\n`)
  return ok ? null : once(stream, 'drain').then(() => undefined)
}

export async function main(argv = process.argv): Promise<void> {
  const marketsPath = flag(argv, '--markets')
  const tradesPath = flag(argv, '--trades')
  const outPath = flag(argv, '--out')
  if (!marketsPath || !tradesPath || !outPath) usage()

  const marketRows = asObjects(await readLocalTable(marketsPath)) as RawPolymarketMarketRow[]
  const markets = filterPolymarketTennisMarkets(marketRows).filter((market) => market.marketKind === 'match_winner')
  const summaries = buildPolymarketMatchWinnerSummaryMap(markets)

  let scannedTradeRows = 0
  let matchedTradeRows = 0
  let matchedUsdVolume = 0
  for await (const rawRow of readLocalJsonLines(tradesPath)) {
    const row = rawRow && typeof rawRow === 'object' && !Array.isArray(rawRow)
      ? rawRow as RawPolymarketTradeRow
      : null
    if (!row) continue
    scannedTradeRows += 1
    const trade = normalizePolymarketTrade(row)
    if (trade.marketId && summaries.has(trade.marketId)) {
      matchedTradeRows += 1
      matchedUsdVolume += trade.usdAmount || 0
      updatePolymarketMatchWinnerSummary(summaries, trade)
    }
  }

  await mkdir(dirname(outPath), { recursive: true })
  const output = createWriteStream(outPath, { encoding: 'utf8' })
  let marketsWithTrades = 0
  let settledMarketsWithTrades = 0
  let outputRows = 0
  for (const summary of summaries.values()) {
    const finalized = finalizePolymarketMatchWinnerSummary(summary)
    if (finalized.tradeCount > 0) {
      marketsWithTrades += 1
      if (finalized.winner !== 'unknown') settledMarketsWithTrades += 1
    }
    outputRows += 1
    const wait = writeLine(output, finalized)
    if (wait) await wait
  }
  output.end()
  await once(output, 'finish')

  console.log(JSON.stringify({
    ok: true,
    marketsPath,
    tradesPath,
    outPath,
    matchWinnerMarkets: summaries.size,
    marketsWithTrades,
    settledMarketsWithTrades,
    scannedTradeRows,
    matchedTradeRows,
    matchedUsdVolume,
    outputRows,
    priceSemantics: 'reported_trade_price_not_player_mapped',
  }, null, 2))
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(JSON.stringify({ ok: false, error: message }, null, 2))
  process.exit(1)
})
