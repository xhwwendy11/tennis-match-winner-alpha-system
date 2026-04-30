import { extractMatchByUrl, parseKalshiMarketTicker } from './extractMatchByUrl.js'
import { AtpClient } from '../atp/client.js'
import { AtpDirectoryClient } from '../atp/directoryClient.js'
import { FlashscoreHistoricalBaselineProvider } from '../flashscore/historicalBaseline.js'
import { MemoryBaselineCache } from '../foundation/baselineCache.js'
import { buildMultiMarketComparison } from '../foundation/multiMarketComparison.js'
import type { PlayerDirectoryEntry } from '../foundation/playerMapping.js'
import { ItfClient } from '../itf/client.js'
import { ItfOfficialDirectoryClient } from '../itf/directoryClient.js'
import { KalshiClient } from '../kalshi/client.js'
import { fetchCanonicalKalshiMarketState } from '../kalshi/marketClient.js'
import { extractCanonicalKalshiMarketStateFromPage } from '../kalshi/statsExtractor.js'
import { extractCanonicalPolymarketMarketStateFromPage } from '../polymarket/liveExtractor.js'
import { WtaClient } from '../wta/client.js'
import { WtaOfficialDirectoryClient } from '../wta/directoryClient.js'
import path from 'node:path'

export interface BuildMultiMarketComparisonByUrlInput {
  flashscoreUrl: string
  kalshiMarketUrl: string
  polymarketMarketUrl: string
  playerDirectory?: PlayerDirectoryEntry[]
  marketImpliedProbA?: number | null
  marketImpliedProbB?: number | null
  surface?: 'hard' | 'clay' | 'grass' | 'indoor' | 'unknown' | null
}

export async function buildMultiMarketComparisonByUrl(
  input: BuildMultiMarketComparisonByUrlInput,
) {
  const baselineCache = new MemoryBaselineCache()

  const base = await extractMatchByUrl(input.flashscoreUrl, {
    playerDirectory: input.playerDirectory || [],
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
    marketImpliedProbA: input.marketImpliedProbA ?? null,
    marketImpliedProbB: input.marketImpliedProbB ?? null,
    surface: input.surface ?? null,
  })

  const kalshiMarketState = await fetchCanonicalKalshiMarketState(parseKalshiMarketTicker(input.kalshiMarketUrl) || '', new KalshiClient()).catch(
    async () => extractCanonicalKalshiMarketStateFromPage(input.kalshiMarketUrl),
  )
  const polymarketMarketState = await extractCanonicalPolymarketMarketStateFromPage(input.polymarketMarketUrl)

  return buildMultiMarketComparison({
    base,
    kalshiMarketState,
    kalshiMarketUrl: input.kalshiMarketUrl,
    polymarketMarketState,
    polymarketMarketUrl: input.polymarketMarketUrl,
  })
}
