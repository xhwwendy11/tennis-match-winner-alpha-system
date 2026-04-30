import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { buildMultiMarketComparisonByUrl } from '../app/buildMultiMarketComparisonByUrl.js'
import type { PlayerDirectoryEntry } from '../foundation/playerMapping.js'
import { buildMultiMarketComparisonStoragePath } from '../foundation/multiMarketDataset.js'

export interface CompareMarketsArgs {
  flashscoreUrl: string
  kalshiMarketUrl: string | null
  polymarketMarketUrl: string | null
  playerDirectoryPath: string | null
  marketImpliedProbA: number | null
  marketImpliedProbB: number | null
  surface: 'hard' | 'clay' | 'grass' | 'indoor' | 'unknown' | null
}

function usage(): never {
  console.error(
    'Usage: tsx src/cli/compareMarkets.ts <flashscore-match-url> --kalshi-market-url url --polymarket-market-url url [--player-directory path] [--market-implied-prob-a n] [--market-implied-prob-b n] [--surface hard|clay|grass|indoor|unknown]',
  )
  process.exit(1)
}

function parseOptionalNumber(value: string | undefined): number | null {
  const parsed = Number(String(value || '').trim())
  return Number.isFinite(parsed) ? parsed : null
}

function getFlag(argv: string[], flag: string): string | undefined {
  const index = argv.indexOf(flag)
  return index >= 0 ? argv[index + 1] : undefined
}

function parseArgs(argv = process.argv): CompareMarketsArgs {
  const positional = argv.slice(2).filter((arg) => !arg.startsWith('--'))
  const flashscoreUrl = positional[0]
  if (!flashscoreUrl) usage()

  const kalshiMarketUrl = getFlag(argv, '--kalshi-market-url') || null
  const polymarketMarketUrl = getFlag(argv, '--polymarket-market-url') || null
  if (!kalshiMarketUrl || !polymarketMarketUrl) usage()

  const surface = getFlag(argv, '--surface')
  return {
    flashscoreUrl,
    kalshiMarketUrl,
    polymarketMarketUrl,
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

export async function main(argv = process.argv): Promise<void> {
  const args = parseArgs(argv)
  const playerDirectory = (await loadPlayerDirectory(args.playerDirectoryPath)) || []
  const comparison = await buildMultiMarketComparisonByUrl({
    flashscoreUrl: args.flashscoreUrl,
    kalshiMarketUrl: args.kalshiMarketUrl!,
    polymarketMarketUrl: args.polymarketMarketUrl!,
    playerDirectory,
    marketImpliedProbA: args.marketImpliedProbA,
    marketImpliedProbB: args.marketImpliedProbB,
    surface: args.surface,
  })

  const relativeOutputPath = buildMultiMarketComparisonStoragePath(comparison)
  const absoluteOutputPath = path.resolve(process.cwd(), relativeOutputPath)
  await mkdir(path.dirname(absoluteOutputPath), { recursive: true })
  await writeFile(absoluteOutputPath, `${JSON.stringify(comparison, null, 2)}\n`, 'utf8')

  console.log(
    JSON.stringify(
      {
        ok: true,
        outputPath: absoluteOutputPath,
        matchId: comparison.match.matchId,
        capturedAt: comparison.capturedAt,
        bothAvailable: comparison.crossMarket.bothAvailable,
      },
      null,
      2,
    ),
  )
}

export { loadPlayerDirectory, parseArgs }

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(JSON.stringify({ ok: false, error: message }, null, 2))
  process.exit(1)
})
