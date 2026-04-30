import { buildResolvedExecutionAudit } from '../foundation/resolvedExecutionAudit.js'

function parseArgs(argv: string[]) {
  const args = [...argv]
  const rootDir = args.shift() || './multi-market-comparisons'
  let outcomeRootDir: string | null = null
  let includeWatchOnly = true
  let includeBlocked = true
  let rankingLimit: number | undefined

  while (args.length) {
    const arg = args.shift()
    if (arg === '--outcomes') {
      outcomeRootDir = args.shift() || null
      continue
    }
    if (arg === '--no-watch-only') {
      includeWatchOnly = false
      continue
    }
    if (arg === '--no-blocked') {
      includeBlocked = false
      continue
    }
    if (arg === '--limit') {
      const value = Number(args.shift())
      if (Number.isFinite(value) && value > 0) rankingLimit = value
    }
  }

  if (!outcomeRootDir) {
    throw new Error('Missing required --outcomes <dir>')
  }

  return {
    rootDir,
    outcomeRootDir,
    includeWatchOnly,
    includeBlocked,
    rankingLimit,
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const report = await buildResolvedExecutionAudit(args.rootDir, {
    outcomeRootDir: args.outcomeRootDir,
    includeWatchOnly: args.includeWatchOnly,
    includeBlocked: args.includeBlocked,
    rankingLimit: args.rankingLimit,
  })
  console.log(JSON.stringify(report, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
