import path from 'node:path'

import { buildCoverageQualityReport } from '../foundation/coverageQualityReport.js'

export async function main(argv = process.argv): Promise<void> {
  const rootDir = argv[2] || path.resolve(process.cwd(), 'snapshots')
  const report = await buildCoverageQualityReport(rootDir)
  console.log(JSON.stringify(report, null, 2))
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(
    JSON.stringify(
      {
        ok: false,
        error: message,
      },
      null,
      2,
    ),
  )
  process.exit(1)
})
