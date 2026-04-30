import path from 'node:path'

import { buildLabeledExecutionDataset } from '../foundation/labeledExecutionDataset.js'

export async function main(argv = process.argv): Promise<void> {
  const args = argv.slice(2)
  let rootDir: string | null = null
  let includeWatchOnly = true
  let includeBlocked = true

  for (const arg of args) {
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
  const dataset = await buildLabeledExecutionDataset(rootDir, { includeWatchOnly, includeBlocked })
  console.log(JSON.stringify(dataset, null, 2))
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(JSON.stringify({ ok: false, error: message }, null, 2))
  process.exit(1)
})
