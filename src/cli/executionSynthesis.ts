import { buildExecutionSynthesis } from '../foundation/executionSynthesis.js'

function parseArgs(argv: string[]) {
  const args = [...argv]
  const rootDir = args.shift() || './multi-market-comparisons'
  let limit: number | undefined
  let includeWatchOnly = true
  let includeBlocked = true

  while (args.length) {
    const arg = args.shift()
    if (arg === '--limit') {
      const value = Number(args.shift())
      if (Number.isFinite(value) && value > 0) limit = value
      continue
    }
    if (arg === '--no-watch-only') {
      includeWatchOnly = false
      continue
    }
    if (arg === '--no-blocked') {
      includeBlocked = false
    }
  }

  return {
    rootDir,
    limit,
    includeWatchOnly,
    includeBlocked,
  }
}

async function main() {
  const { rootDir, limit, includeWatchOnly, includeBlocked } = parseArgs(process.argv.slice(2))
  const report = await buildExecutionSynthesis(rootDir, {
    rankingLimit: limit,
    includeWatchOnly,
    includeBlocked,
  })
  console.log(JSON.stringify(report, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
