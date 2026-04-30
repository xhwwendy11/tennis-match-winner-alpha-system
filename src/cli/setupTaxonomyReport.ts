import path from 'node:path'

import { buildSetupTaxonomyReport } from '../foundation/setupTaxonomyReport.js'

export async function main(argv = process.argv): Promise<void> {
  const args = argv.slice(2)
  let rootDir: string | null = null

  for (const arg of args) {
    if (!arg.startsWith('--') && !rootDir) rootDir = arg
  }

  rootDir ||= path.resolve(process.cwd(), 'multi-market-comparisons')
  const report = await buildSetupTaxonomyReport(rootDir)
  console.log(JSON.stringify(report, null, 2))
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(JSON.stringify({ ok: false, error: message }, null, 2))
  process.exit(1)
})
