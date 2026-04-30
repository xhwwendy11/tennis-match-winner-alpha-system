import path from 'node:path'

import { buildPFairCalibrationReport } from '../foundation/pfairCalibration.js'
import { loadDecisionSnapshots } from '../foundation/calibrationReport.js'

function parseOptionalNumber(value: string | undefined): number | undefined {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function parseArgs(argv: string[]): {
  snapshotRootDir: string
  outcomeRootDir: string | null
  priorStrength?: number
  maxAdjustment?: number
} {
  const args = argv.slice(2)
  let snapshotRootDir: string | null = null
  let outcomeRootDir: string | null = null
  let priorStrength: number | undefined
  let maxAdjustment: number | undefined

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === '--outcomes') {
      outcomeRootDir = args[index + 1] || path.resolve(process.cwd(), 'data/outcomes/flashscore')
      index += 1
      continue
    }
    if (arg === '--prior-strength') {
      priorStrength = parseOptionalNumber(args[index + 1])
      index += 1
      continue
    }
    if (arg === '--max-adjustment') {
      maxAdjustment = parseOptionalNumber(args[index + 1])
      index += 1
      continue
    }
    if (!arg.startsWith('--') && !snapshotRootDir) snapshotRootDir = arg
  }

  return {
    snapshotRootDir: snapshotRootDir || path.resolve(process.cwd(), 'snapshots'),
    outcomeRootDir,
    priorStrength,
    maxAdjustment,
  }
}

export async function main(argv = process.argv): Promise<void> {
  const args = parseArgs(argv)
  const snapshots = await loadDecisionSnapshots(args.snapshotRootDir)
  const report = await buildPFairCalibrationReport({
    snapshots,
    outcomeRootDir: args.outcomeRootDir,
    config: {
      priorStrength: args.priorStrength,
      maxAdjustment: args.maxAdjustment,
    },
  })

  console.log(JSON.stringify(report, null, 2))
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(JSON.stringify({ ok: false, error: message }, null, 2))
  process.exit(1)
})
