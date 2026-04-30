import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { readFile } from 'node:fs/promises'

import { extractMatchByUrl } from '../app/extractMatchByUrl.js'
import { AtpClient } from '../atp/client.js'
import { AtpDirectoryClient } from '../atp/directoryClient.js'
import { MemoryBaselineCache } from '../foundation/baselineCache.js'
import type { PlayerDirectoryEntry } from '../foundation/playerMapping.js'
import { buildKalshiMarketSnapshotStoragePath, buildSnapshotStoragePath } from '../foundation/snapshotDataset.js'
import { ItfClient } from '../itf/client.js'
import { ItfOfficialDirectoryClient } from '../itf/directoryClient.js'
import { FlashscoreHistoricalBaselineProvider } from '../flashscore/historicalBaseline.js'
import { KalshiClient } from '../kalshi/client.js'
import { fetchKalshiMarketSnapshot, fetchKalshiTrades } from '../kalshi/marketClient.js'
import { buildKalshiMarketSnapshot } from '../kalshi/marketSnapshot.js'
import { WtaClient } from '../wta/client.js'
import { WtaOfficialDirectoryClient } from '../wta/directoryClient.js'

interface CaptureSnapshotArgs {
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
    'Usage: tsx src/cli/captureSnapshot.ts <flashscore-match-url> [market-url] [--kalshi-market-url url] [--polymarket-market-url url] [--player-directory path] [--market-implied-prob-a n] [--market-implied-prob-b n] [--surface hard|clay|grass|indoor|unknown]',
  )
  process.exit(1)
}

function parseOptionalNumber(value: string | undefined): number | null {
  const parsed = Number(String(value || '').trim())
  return Number.isFinite(parsed) ? parsed : null
}

function parseArgs(argv = process.argv): CaptureSnapshotArgs {
  const positional = argv.slice(2).filter((arg) => !arg.startsWith('--'))
  const flashscoreUrl = positional[0]
  if (!flashscoreUrl) usage()

  const getFlag = (flag: string): string | undefined => {
    const index = argv.indexOf(flag)
    return index >= 0 ? argv[index + 1] : undefined
  }

  const explicitKalshiMarketUrl = getFlag('--kalshi-market-url') || null
  const explicitPolymarketMarketUrl = getFlag('--polymarket-market-url') || null
  const positionalMarketUrl = positional[1] || null
  const inferredKalshiMarketUrl =
    explicitKalshiMarketUrl ||
    (positionalMarketUrl && positionalMarketUrl.includes('kalshi.com') ? positionalMarketUrl : null)
  const inferredPolymarketMarketUrl =
    explicitPolymarketMarketUrl ||
    (positionalMarketUrl && positionalMarketUrl.includes('polymarket.com') ? positionalMarketUrl : null)
  const surface = getFlag('--surface')

  return {
    flashscoreUrl,
    kalshiMarketUrl: inferredKalshiMarketUrl,
    polymarketMarketUrl: inferredPolymarketMarketUrl,
    playerDirectoryPath: getFlag('--player-directory') || null,
    marketImpliedProbA: parseOptionalNumber(getFlag('--market-implied-prob-a')),
    marketImpliedProbB: parseOptionalNumber(getFlag('--market-implied-prob-b')),
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

async function persistPlayerDirectory(filePath: string | null, entries: PlayerDirectoryEntry[]): Promise<void> {
  if (!filePath) return
  const absolutePath = path.resolve(process.cwd(), filePath)
  const existing = (await loadPlayerDirectory(filePath)) || []
  const merged = [...existing]

  for (const entry of entries) {
    const duplicate = merged.find((candidate) => {
      if (candidate.source !== entry.source) return false
      if (candidate.sourcePlayerId !== entry.sourcePlayerId) return false
      if ((candidate.flashscorePlayerId || null) !== (entry.flashscorePlayerId || null)) return false
      if ((candidate.flashscoreSlug || null) !== (entry.flashscoreSlug || null)) return false
      return true
    })
    if (!duplicate) merged.push(entry)
  }

  await mkdir(path.dirname(absolutePath), { recursive: true })
  await writeFile(absolutePath, `${JSON.stringify(merged, null, 2)}\n`, 'utf8')
}

export async function main(argv = process.argv): Promise<void> {
  const args = parseArgs(argv)
  const playerDirectory = (await loadPlayerDirectory(args.playerDirectoryPath)) || []
  const baselineCache = new MemoryBaselineCache()

  const result = await extractMatchByUrl(args.flashscoreUrl, {
    kalshiMarketUrl: args.kalshiMarketUrl,
    polymarketMarketUrl: args.polymarketMarketUrl,
    canonicalMarketState: null,
    kalshiClient: args.kalshiMarketUrl ? new KalshiClient() : undefined,
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
    persistDiscoveredEntries: args.playerDirectoryPath
      ? async (entries) => persistPlayerDirectory(args.playerDirectoryPath, entries)
      : undefined,
    baselineCache,
    marketImpliedProbA: args.marketImpliedProbA,
    marketImpliedProbB: args.marketImpliedProbB,
    surface: args.surface,
  })
  const relativeOutputPath = buildSnapshotStoragePath(result.decisionSnapshot)
  const absoluteOutputPath = path.resolve(process.cwd(), relativeOutputPath)

  await mkdir(path.dirname(absoluteOutputPath), { recursive: true })
  await writeFile(absoluteOutputPath, `${JSON.stringify(result.decisionSnapshot, null, 2)}\n`, 'utf8')

  let absoluteMarketSnapshotPath: string | null = null
  if (result.canonicalMarketState && args.kalshiMarketUrl) {
    const marketTicker = result.canonicalMarketState.marketTicker
    const marketData = marketTicker
      ? await fetchKalshiMarketSnapshot(marketTicker, new KalshiClient()).catch(() => null)
      : null
    const trades = marketTicker
      ? await fetchKalshiTrades(marketTicker, new KalshiClient(), { limit: 100 }).catch(() => null)
      : null
    const marketSnapshot = buildKalshiMarketSnapshot({
      capturedAt: result.decisionSnapshot.capturedAt,
      sourceUrl: args.kalshiMarketUrl,
      marketState: result.canonicalMarketState,
      orderbook: marketData
        ? {
            yes: marketData.yesLevels,
            no: marketData.noLevels,
          }
        : null,
      trades: trades
        ? {
            items: trades.trades,
            cursor: trades.cursor,
          }
        : null,
    })
    const relativeMarketSnapshotPath = buildKalshiMarketSnapshotStoragePath(marketSnapshot)
    absoluteMarketSnapshotPath = path.resolve(process.cwd(), relativeMarketSnapshotPath)
    await mkdir(path.dirname(absoluteMarketSnapshotPath), { recursive: true })
    await writeFile(absoluteMarketSnapshotPath, `${JSON.stringify(marketSnapshot, null, 2)}\n`, 'utf8')
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        outputPath: absoluteOutputPath,
        marketSnapshotPath: absoluteMarketSnapshotPath,
        marketProvider: args.kalshiMarketUrl ? 'kalshi' : args.polymarketMarketUrl ? 'polymarket' : null,
        matchId: result.decisionSnapshot.match.matchId,
        capturedAt: result.decisionSnapshot.capturedAt,
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
