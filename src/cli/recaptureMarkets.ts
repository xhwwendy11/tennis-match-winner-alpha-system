import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { buildMultiMarketComparisonByUrl } from '../app/buildMultiMarketComparisonByUrl.js'
import type { PlayerDirectoryEntry } from '../foundation/playerMapping.js'
import { buildMultiMarketComparisonStoragePath } from '../foundation/multiMarketDataset.js'

interface RecaptureMarketsArgs {
  flashscoreUrl: string
  kalshiMarketUrl: string
  polymarketMarketUrl: string
  intervalSeconds: number
  iterations: number
  playerDirectoryPath: string | null
  marketImpliedProbA: number | null
  marketImpliedProbB: number | null
  surface: 'hard' | 'clay' | 'grass' | 'indoor' | 'unknown' | null
}

function usage(): never {
  console.error(
    'Usage: tsx src/cli/recaptureMarkets.ts <flashscore-match-url> --kalshi-market-url url --polymarket-market-url url [--interval-seconds 120] [--iterations 5] [--player-directory path] [--market-implied-prob-a n] [--market-implied-prob-b n] [--surface hard|clay|grass|indoor|unknown]',
  )
  process.exit(1)
}

function getFlag(argv: string[], flag: string): string | undefined {
  const index = argv.indexOf(flag)
  return index >= 0 ? argv[index + 1] : undefined
}

function parseOptionalNumber(value: string | undefined): number | null {
  const parsed = Number(String(value || '').trim())
  return Number.isFinite(parsed) ? parsed : null
}

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(String(value || '').trim())
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

function parseArgs(argv = process.argv): RecaptureMarketsArgs {
  const positional = argv.slice(2).filter((arg) => !arg.startsWith('--'))
  const flashscoreUrl = positional[0]
  if (!flashscoreUrl) usage()

  const kalshiMarketUrl = getFlag(argv, '--kalshi-market-url')
  const polymarketMarketUrl = getFlag(argv, '--polymarket-market-url')
  if (!kalshiMarketUrl || !polymarketMarketUrl) usage()

  const surface = getFlag(argv, '--surface')
  return {
    flashscoreUrl,
    kalshiMarketUrl,
    polymarketMarketUrl,
    intervalSeconds: parsePositiveInteger(getFlag(argv, '--interval-seconds'), 120),
    iterations: parsePositiveInteger(getFlag(argv, '--iterations'), 5),
    playerDirectoryPath: getFlag(argv, '--player-directory') || null,
    marketImpliedProbA: parseOptionalNumber(getFlag(argv, '--market-implied-prob-a')),
    marketImpliedProbB: parseOptionalNumber(getFlag(argv, '--market-implied-prob-b')),
    surface:
      surface === 'hard' || surface === 'clay' || surface === 'grass' || surface === 'indoor' || surface === 'unknown'
        ? surface
        : null,
  }
}

async function loadPlayerDirectory(filePath: string | null): Promise<PlayerDirectoryEntry[] | undefined> {
  if (!filePath) return undefined
  const text = await readFile(path.resolve(process.cwd(), filePath), 'utf8')
  const parsed = JSON.parse(text)
  return Array.isArray(parsed) ? (parsed as PlayerDirectoryEntry[]) : undefined
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function main(argv = process.argv): Promise<void> {
  const args = parseArgs(argv)
  const playerDirectory = (await loadPlayerDirectory(args.playerDirectoryPath)) || []
  const outputPaths: string[] = []

  for (let index = 0; index < args.iterations; index += 1) {
    const comparison = await buildMultiMarketComparisonByUrl({
      flashscoreUrl: args.flashscoreUrl,
      kalshiMarketUrl: args.kalshiMarketUrl,
      polymarketMarketUrl: args.polymarketMarketUrl,
      playerDirectory,
      marketImpliedProbA: args.marketImpliedProbA,
      marketImpliedProbB: args.marketImpliedProbB,
      surface: args.surface,
    })

    const relativeOutputPath = buildMultiMarketComparisonStoragePath(comparison)
    const absoluteOutputPath = path.resolve(process.cwd(), relativeOutputPath)
    await mkdir(path.dirname(absoluteOutputPath), { recursive: true })
    await writeFile(absoluteOutputPath, `${JSON.stringify(comparison, null, 2)}\n`, 'utf8')
    outputPaths.push(absoluteOutputPath)

    if (index + 1 < args.iterations) {
      await sleep(args.intervalSeconds * 1000)
    }
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        iterations: args.iterations,
        intervalSeconds: args.intervalSeconds,
        outputPaths,
      },
      null,
      2,
    ),
  )
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(JSON.stringify({ ok: false, error: message }, null, 2))
  process.exit(1)
})
