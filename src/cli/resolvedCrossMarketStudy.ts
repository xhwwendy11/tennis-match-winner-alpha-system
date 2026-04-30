import path from 'node:path'

import { buildResolvedCrossMarketStudy } from '../foundation/resolvedCrossMarketStudy.js'

export async function main(argv = process.argv): Promise<void> {
  const args = argv.slice(2)
  let rootDir: string | null = null
  let outcomeRootDir: string | null = null

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === '--outcomes') {
      outcomeRootDir = args[index + 1] || path.resolve(process.cwd(), 'data/outcomes/flashscore')
      index += 1
      continue
    }
    if (!arg.startsWith('--') && !rootDir) rootDir = arg
  }

  rootDir ||= path.resolve(process.cwd(), 'multi-market-comparisons')
  const study = await buildResolvedCrossMarketStudy(rootDir, { outcomeRootDir })
  console.log(JSON.stringify(study, null, 2))
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(JSON.stringify({ ok: false, error: message }, null, 2))
  process.exit(1)
})
