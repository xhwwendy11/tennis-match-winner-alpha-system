import { readLocalJsonLines, readLocalTable } from '../polymarket/localFiles.js'
import { buildPolymarketHistoryReport } from '../polymarket/historyReport.js'
import type { PolymarketMatchWinnerPriceSummary } from '../polymarket/types.js'

function usage(): never {
  console.error('Usage: tsx src/cli/polymarketHistoryReport.ts price-series.jsonl')
  process.exit(1)
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

  const summaries = await loadSummaries(inputPath)
  const report = buildPolymarketHistoryReport(summaries, { inputPath })
  console.log(JSON.stringify(report, null, 2))
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(JSON.stringify({ ok: false, error: message }, null, 2))
  process.exit(1)
})
