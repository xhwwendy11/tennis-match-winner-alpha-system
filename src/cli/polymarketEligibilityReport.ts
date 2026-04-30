import { readLocalJsonLines, readLocalTable } from '../polymarket/localFiles.js'
import {
  buildPolymarketEligibilityReport,
  DEFAULT_POLYMARKET_ELIGIBILITY_RULE,
} from '../polymarket/eligibility.js'
import type { PolymarketMatchWinnerPriceSummary } from '../polymarket/types.js'

function usage(): never {
  console.error('Usage: tsx src/cli/polymarketEligibilityReport.ts price-series.jsonl [--min-usd-volume 1000] [--min-trade-count 20]')
  process.exit(1)
}

function flag(argv: string[], name: string): string | null {
  const index = argv.indexOf(name)
  return index >= 0 ? argv[index + 1] || null : null
}

function asSummary(row: unknown): PolymarketMatchWinnerPriceSummary | null {
  return row && typeof row === 'object' && !Array.isArray(row)
    ? row as PolymarketMatchWinnerPriceSummary
    : null
}

async function loadSummaries(filePath: string): Promise<PolymarketMatchWinnerPriceSummary[]> {
  const lower = filePath.toLowerCase()
  if (lower.endsWith('.jsonl') || lower.endsWith('.ndjson')) {
    const summaries: PolymarketMatchWinnerPriceSummary[] = []
    for await (const row of readLocalJsonLines(filePath)) {
      const parsed = asSummary(row)
      if (parsed) summaries.push(parsed)
    }
    return summaries
  }
  return (await readLocalTable(filePath))
    .map(asSummary)
    .filter((row): row is PolymarketMatchWinnerPriceSummary => row != null)
}

export async function main(argv = process.argv): Promise<void> {
  const inputPath = argv[2]
  if (!inputPath) usage()

  const minUsdVolume = Number(flag(argv, '--min-usd-volume') || DEFAULT_POLYMARKET_ELIGIBILITY_RULE.minUsdVolume)
  const minTradeCount = Number(flag(argv, '--min-trade-count') || DEFAULT_POLYMARKET_ELIGIBILITY_RULE.minTradeCount)

  const summaries = await loadSummaries(inputPath)
  const report = buildPolymarketEligibilityReport(summaries, {
    inputPath,
    rule: {
      ...DEFAULT_POLYMARKET_ELIGIBILITY_RULE,
      minUsdVolume,
      minTradeCount,
    },
  })
  console.log(JSON.stringify(report, null, 2))
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(JSON.stringify({ ok: false, error: message }, null, 2))
  process.exit(1)
})
