import { buildPortfolioRiskBudget } from '../foundation/portfolioRiskBudget.js'

function parseArgs(argv: string[]) {
  const args = [...argv]
  const rootDir = args.shift() || './multi-market-comparisons'
  let bankrollUsd: number | undefined
  let maxPortfolioFraction: number | undefined
  let maxSingleIdeaFraction: number | undefined
  let maxProviderFraction: number | undefined
  let rankingLimit: number | undefined
  let includeWatchOnly = true
  let includeBlocked = true

  while (args.length) {
    const arg = args.shift()
    if (arg === '--bankroll-usd') {
      const value = Number(args.shift())
      if (Number.isFinite(value) && value > 0) bankrollUsd = value
      continue
    }
    if (arg === '--max-portfolio-fraction') {
      const value = Number(args.shift())
      if (Number.isFinite(value) && value > 0) maxPortfolioFraction = value
      continue
    }
    if (arg === '--max-single-idea-fraction') {
      const value = Number(args.shift())
      if (Number.isFinite(value) && value > 0) maxSingleIdeaFraction = value
      continue
    }
    if (arg === '--max-provider-fraction') {
      const value = Number(args.shift())
      if (Number.isFinite(value) && value > 0) maxProviderFraction = value
      continue
    }
    if (arg === '--limit') {
      const value = Number(args.shift())
      if (Number.isFinite(value) && value > 0) rankingLimit = value
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
    policy: {
      ...(bankrollUsd ? { bankrollUsd } : {}),
      ...(maxPortfolioFraction ? { maxPortfolioFraction } : {}),
      ...(maxSingleIdeaFraction ? { maxSingleIdeaFraction } : {}),
      ...(maxProviderFraction ? { maxProviderFraction } : {}),
    },
    rankingLimit,
    includeWatchOnly,
    includeBlocked,
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const report = await buildPortfolioRiskBudget(args.rootDir, {
    policy: args.policy,
    rankingLimit: args.rankingLimit,
    includeWatchOnly: args.includeWatchOnly,
    includeBlocked: args.includeBlocked,
  })
  console.log(JSON.stringify(report, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
