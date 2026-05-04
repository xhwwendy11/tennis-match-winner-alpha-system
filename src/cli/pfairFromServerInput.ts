import { readFile } from 'node:fs/promises'
import path from 'node:path'

import { extractMatchFromServerPayload } from '../app/extractMatchFromServerPayload.js'
import { AtpClient } from '../atp/client.js'
import { AtpDirectoryClient } from '../atp/directoryClient.js'
import { FlashscoreHistoricalBaselineProvider } from '../flashscore/historicalBaseline.js'
import { MemoryBaselineCache } from '../foundation/baselineCache.js'
import type { PlayerDirectoryEntry } from '../foundation/playerMapping.js'
import { inferSnapshotQuality } from '../foundation/snapshotReportEnrichment.js'
import { ItfClient } from '../itf/client.js'
import { ItfOfficialDirectoryClient } from '../itf/directoryClient.js'
import type { ServerTennisMatchEnvelope, ServerTennisMatchPayload } from '../server/tennisPayload.js'
import { WtaClient } from '../wta/client.js'
import { WtaOfficialDirectoryClient } from '../wta/directoryClient.js'

interface Args {
  inputPath: string
  playerDirectoryPath: string | null
  surface: 'hard' | 'clay' | 'grass' | 'indoor' | 'unknown' | null
  enrichFlashscoreStats: boolean
}

function usage(): never {
  console.error(
    'Usage: tsx src/cli/pfairFromServerInput.ts <server-match-json> [--player-directory path] [--surface hard|clay|grass|indoor|unknown] [--enrich-flashscore-stats]',
  )
  process.exit(1)
}

function parseArgs(argv = process.argv): Args {
  const positional = argv.slice(2).filter((arg) => !arg.startsWith('--'))
  const inputPath = positional[0]
  if (!inputPath) usage()

  const getFlag = (flag: string): string | undefined => {
    const index = argv.indexOf(flag)
    return index >= 0 ? argv[index + 1] : undefined
  }

  const surface = getFlag('--surface')

  return {
    inputPath,
    playerDirectoryPath: getFlag('--player-directory') || null,
    enrichFlashscoreStats: argv.includes('--enrich-flashscore-stats'),
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
  const absoluteInputPath = path.resolve(process.cwd(), args.inputPath)
  const text = await readFile(absoluteInputPath, 'utf8')
  const payload = JSON.parse(text) as ServerTennisMatchPayload | ServerTennisMatchEnvelope
  const playerDirectory = (await loadPlayerDirectory(args.playerDirectoryPath)) || []
  const baselineCache = new MemoryBaselineCache()

  const result = await extractMatchFromServerPayload(payload, {
    playerDirectory,
    atpClient: new AtpClient(),
    atpDirectoryClient: new AtpDirectoryClient(),
    wtaClient: new WtaClient(),
    wtaDirectoryClient: new WtaOfficialDirectoryClient(),
    itfClient: new ItfClient(),
    itfDirectoryClient: new ItfOfficialDirectoryClient(),
    flashscoreHistoricalBaselineClient: new FlashscoreHistoricalBaselineProvider({
      cacheDir: path.resolve(process.cwd(), 'data/baselines/flashscore-history'),
      cacheOnly: true,
    }),
    historicalMaxMatches: 0,
    historicalMinStatMatches: 2,
    baselineCache,
    surface: args.surface,
    enrichFlashscoreStats: args.enrichFlashscoreStats,
  })

  const quality = inferSnapshotQuality(result.decisionSnapshot)
  const pFair = result.probabilityState.pFair
  console.log(
    JSON.stringify(
      {
        ok: true,
        inputPath: absoluteInputPath,
        match: {
          matchId: result.decisionSnapshot.match.matchId,
          teamA: result.decisionSnapshot.match.teamA,
          teamB: result.decisionSnapshot.match.teamB,
          status: result.decisionSnapshot.match.status,
          serverSide: result.decisionSnapshot.match.serverSide,
          setIndex: result.decisionSnapshot.match.setIndex,
          currentSetGamesA: result.decisionSnapshot.match.currentSetGamesA,
          currentSetGamesB: result.decisionSnapshot.match.currentSetGamesB,
          currentGamePointsA: result.decisionSnapshot.match.currentGamePointsA,
          currentGamePointsB: result.decisionSnapshot.match.currentGamePointsB,
        },
        baseline: {
          source: result.prematchBaseline?.source ?? null,
          complete: result.prematchBaseline?.complete ?? false,
          holdBaselineA: result.prematchBaseline?.holdBaselineA ?? null,
          holdBaselineB: result.prematchBaseline?.holdBaselineB ?? null,
          breakBaselineA: result.prematchBaseline?.breakBaselineA ?? null,
          breakBaselineB: result.prematchBaseline?.breakBaselineB ?? null,
        },
        sourceCoverage: result.decisionSnapshot.sourceCoverage,
        quality,
        risk: result.decisionSnapshot.risk,
        statsAvailable: result.decisionSnapshot.sourceCoverage.flashscoreStatsAvailable,
        pPoint: pFair.point,
        pGame: pFair.game,
        pSet: pFair.set,
        pMatch: pFair.match,
        pFair: {
          point: pFair.point,
          game: pFair.game,
          set: pFair.set,
          match: pFair.match,
          anchor: pFair.anchor,
          diagnostics: pFair.diagnostics,
        },
      },
      null,
      2,
    ),
  )
}

main().then(() => {
  process.exit(0)
}).catch((error) => {
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
