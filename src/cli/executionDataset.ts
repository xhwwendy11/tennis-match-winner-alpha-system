import path from 'node:path'

import { buildExecutionDataset } from '../foundation/executionDataset.js'

export async function main(argv = process.argv): Promise<void> {
  const args = argv.slice(2)
  let rootDir: string | null = null
  let includeWatchOnly = true
  let includeBlocked = true

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
    if (!arg.startsWith('--') && !rootDir) rootDir = arg
  }

  rootDir ||= path.resolve(process.cwd(), 'multi-market-comparisons')
  const dataset = await buildExecutionDataset(rootDir, { includeWatchOnly, includeBlocked })
  console.log(JSON.stringify(dataset, null, 2))
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(JSON.stringify({ ok: false, error: message }, null, 2))
  process.exit(1)
})
