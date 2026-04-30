import path from 'node:path'

import { buildExecutionRankingReport } from '../foundation/executionRanking.js'

function parsePositiveInteger(value: string | undefined): number | null {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

export async function main(argv = process.argv): Promise<void> {
  const args = argv.slice(2)
  let rootDir: string | null = null
  let includeWatchOnly = true
  let includeBlocked = true
  let limit: number | null = null

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === '--no-watch-only') {
      includeWatchOnly = false
      continue
    }
    if (arg === '--no-blocked') {
      includeBlocked = false
      continue
    }
    if (arg === '--limit') {
      limit = parsePositiveInteger(args[index + 1])
      index += 1
      continue
    }
    if (!arg.startsWith('--') && !rootDir) rootDir = arg
  }

  rootDir ||= path.resolve(process.cwd(), 'multi-market-comparisons')
  const report = await buildExecutionRankingReport(rootDir, { includeWatchOnly, includeBlocked, limit })
  console.log(JSON.stringify(report, null, 2))
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(JSON.stringify({ ok: false, error: message }, null, 2))
  process.exit(1)
})
