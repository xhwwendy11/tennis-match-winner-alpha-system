import {
  buildCanonicalMatchState,
  inferCompetitionGenderFromKalshiUrl,
  withCompetitionGender,
} from '../foundation/canonicalMatchState.js'
import type { CanonicalMarketState } from '../foundation/canonicalMarketState.js'
import { buildDecisionSnapshot } from '../foundation/decisionSnapshot.js'
import { buildPrematchBaseline } from '../foundation/prematchBaselineBuilder.js'
import { buildPrematchBaselineFromProviders } from '../foundation/prematchBaselineProvider.js'
import type { PrematchBaseline } from '../foundation/prematchBaseline.js'
import { buildResolvedStats } from '../foundation/resolvedStats.js'
import type { ItfClient } from '../itf/client.js'
import type { AtpDirectoryClient } from '../atp/directoryClient.js'
import type { WtaDirectoryClient } from '../wta/directoryClient.js'
import type { ItfDirectoryClient } from '../itf/directoryClient.js'
import { KalshiClient } from '../kalshi/client.js'
import { fetchCanonicalKalshiMarketState } from '../kalshi/marketClient.js'
import { buildProbabilityState } from '../probability/probabilityState.js'
import { extractCanonicalKalshiMarketStateFromPage, extractKalshiDisplayStats } from '../kalshi/statsExtractor.js'
import type { KalshiDisplayStats } from '../kalshi/types.js'
import { extractCanonicalPolymarketMarketStateFromPage } from '../polymarket/liveExtractor.js'
import { fetchDirectMatchPage as fetchDirectTennisMatchPage } from '../realtime-score/tennis/scoreboardClient.js'
import { evaluateTennisPointRisk } from '../rules/tennis/pointRiskEngine.js'
import { deriveTennisTradePlan } from '../rules/tennis/tradePlan.js'

export type SupportedSport = 'tennis'

export type ExtractByUrlSuccess =
  | {
      ok: boolean
      sport: 'tennis'
      inputUrl: string
      normalizedUrl: string
      kalshiMarketUrl: string | null
      polymarketMarketUrl: string | null
      pageFetchCount: number
      matchCount: number
      match: Awaited<ReturnType<typeof fetchDirectTennisMatchPage>>[number] | null
      canonicalMatchState: ReturnType<typeof buildCanonicalMatchState>
      canonicalMarketState: CanonicalMarketState | null
      flashscoreRawStats: Awaited<ReturnType<typeof fetchDirectTennisMatchPage>>[number]['stats'] | null
      kalshiDisplayStats: KalshiDisplayStats | null
      resolvedStats: ReturnType<typeof buildResolvedStats>
      prematchBaseline: PrematchBaseline | null
      pointRisk: ReturnType<typeof evaluateTennisPointRisk>
      probabilityState: ReturnType<typeof buildProbabilityState>
      decisionSnapshot: ReturnType<typeof buildDecisionSnapshot>
    }

export interface ExtractByUrlOptions {
  kalshiMarketUrl?: string | null
  polymarketMarketUrl?: string | null
  prematchBaseline?: PrematchBaseline | null
  playerDirectory?: Parameters<typeof buildPrematchBaselineFromProviders>[1]['directory']
  atpClient?: Parameters<typeof buildPrematchBaselineFromProviders>[1]['atpClient']
  atpDirectoryClient?: Parameters<typeof buildPrematchBaselineFromProviders>[1]['atpDirectoryClient']
  wtaClient?: Parameters<typeof buildPrematchBaselineFromProviders>[1]['wtaClient']
  wtaDirectoryClient?: Parameters<typeof buildPrematchBaselineFromProviders>[1]['wtaDirectoryClient']
  itfClient?: Parameters<typeof buildPrematchBaselineFromProviders>[1]['itfClient']
  itfDirectoryClient?: Parameters<typeof buildPrematchBaselineFromProviders>[1]['itfDirectoryClient']
  persistDiscoveredEntries?: Parameters<typeof buildPrematchBaselineFromProviders>[1]['persistDiscoveredEntries']
  baselineCache?: Parameters<typeof buildPrematchBaselineFromProviders>[1]['baselineCache']
  flashscoreHistoricalBaselineClient?: Parameters<typeof buildPrematchBaselineFromProviders>[1]['flashscoreHistoricalBaselineClient']
  historicalMaxMatches?: Parameters<typeof buildPrematchBaselineFromProviders>[1]['historicalMaxMatches']
  historicalMinStatMatches?: Parameters<typeof buildPrematchBaselineFromProviders>[1]['historicalMinStatMatches']
  marketImpliedProbA?: number | null
  marketImpliedProbB?: number | null
  surface?: PrematchBaseline['surface'] | null
  canonicalMarketState?: CanonicalMarketState | null
  kalshiClient?: KalshiClient
}

export function parseKalshiMarketTicker(kalshiMarketUrl: string | null | undefined): string | null {
  const value = String(kalshiMarketUrl || '').trim()
  if (!value) return null

  try {
    const parsed = new URL(value)
    const parts = parsed.pathname.split('/').filter(Boolean)
    return parts.length > 0 ? parts[parts.length - 1] || null : null
  } catch {
    return null
  }
}

export function normalizeFlashscoreUrl(raw: string): string {
  const value = String(raw || '').trim()
  if (!value) throw new Error('Missing URL')

  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    throw new Error('Invalid URL')
  }

  const host = String(parsed.hostname || '').toLowerCase()
  if (!host.includes('flashscore.')) {
    throw new Error('URL must point to flashscore')
  }

  parsed.protocol = 'https:'
  parsed.hostname = 'www.flashscore.com'
  parsed.hash = ''
  return parsed.toString()
}

export function detectSport(matchUrl: string): SupportedSport {
  const parsed = new URL(matchUrl)
  const parts = parsed.pathname.split('/').filter(Boolean)
  if (parts[0] !== 'match') throw new Error('Only direct Flashscore match URLs are supported')
  const sport = String(parts[1] || '').toLowerCase()
  if (sport === 'tennis') return sport
  throw new Error(`Unsupported sport in URL: ${sport || 'unknown'}`)
}

export async function extractMatchByUrl(rawUrl: string, options?: ExtractByUrlOptions): Promise<ExtractByUrlSuccess> {
  const matchUrl = normalizeFlashscoreUrl(rawUrl)
  const sport = detectSport(matchUrl)
  const stats = { pageFetchCount: 0 }
  const kalshiMarketUrl = String(options?.kalshiMarketUrl || '').trim() || null
  const polymarketMarketUrl = String(options?.polymarketMarketUrl || '').trim() || null

  const matches = await fetchDirectTennisMatchPage(matchUrl, { force: true, stats })
  const match = Array.isArray(matches) ? matches[0] || null : null
  const canonicalMatchState = withCompetitionGender(
    buildCanonicalMatchState(match),
    inferCompetitionGenderFromKalshiUrl(kalshiMarketUrl),
  )
  const canonicalMarketState =
    options?.canonicalMarketState ??
    (kalshiMarketUrl
      ? (
          options?.kalshiClient
            ? await fetchCanonicalKalshiMarketState(parseKalshiMarketTicker(kalshiMarketUrl) || '', options.kalshiClient).catch(
                async () => extractCanonicalKalshiMarketStateFromPage(kalshiMarketUrl),
              )
            : await extractCanonicalKalshiMarketStateFromPage(kalshiMarketUrl)
        )
      : polymarketMarketUrl
        ? await extractCanonicalPolymarketMarketStateFromPage(polymarketMarketUrl)
      : null)
  const flashscoreRawStats = match?.stats ?? null
  const kalshiDisplayStats = kalshiMarketUrl ? await extractKalshiDisplayStats(kalshiMarketUrl) : null
  const resolvedStats = buildResolvedStats({
    flashscore: flashscoreRawStats,
    kalshi: kalshiDisplayStats,
  })
  const pointRisk = evaluateTennisPointRisk(match)
  const marketImpliedProbA = options?.marketImpliedProbA ?? null
  const marketImpliedProbB = options?.marketImpliedProbB ?? null
  const prematchBaseline =
    options?.prematchBaseline ??
    (
      options?.playerDirectory
        ? (
            await buildPrematchBaselineFromProviders(
              {
                matchState: canonicalMatchState,
                marketImpliedProbA,
                marketImpliedProbB,
                surface: options?.surface,
              },
              {
                directory: options.playerDirectory,
                atpClient: options.atpClient,
                atpDirectoryClient: options.atpDirectoryClient,
                wtaClient: options.wtaClient,
                wtaDirectoryClient: options.wtaDirectoryClient,
                itfClient: options.itfClient,
                itfDirectoryClient: options.itfDirectoryClient,
                persistDiscoveredEntries: options.persistDiscoveredEntries,
                baselineCache: options.baselineCache,
                flashscoreHistoricalBaselineClient: options.flashscoreHistoricalBaselineClient,
                historicalMaxMatches: options.historicalMaxMatches,
                historicalMinStatMatches: options.historicalMinStatMatches,
              },
            )
          ).prematchBaseline
        : buildPrematchBaseline({
            matchState: canonicalMatchState,
            playerA: null,
            playerB: null,
            marketImpliedProbA,
            marketImpliedProbB,
            surface: options?.surface,
          })
    )
  const probabilityState = buildProbabilityState({
    state: canonicalMatchState,
    pointRisk,
    baseline: prematchBaseline,
    resolvedStats,
  })
  const tradePlan = deriveTennisTradePlan(match, pointRisk)
  const decisionSnapshot = buildDecisionSnapshot({
    canonicalMatchState,
    canonicalMarketState,
    kalshiMarketUrl,
    polymarketMarketUrl,
    kalshiDisplayStats,
    resolvedStats,
    prematchBaseline,
    pointRisk,
    probabilityState,
    tradePlan,
  })
  return {
    ok: !!match,
    sport,
    inputUrl: rawUrl,
    normalizedUrl: matchUrl,
    kalshiMarketUrl,
    polymarketMarketUrl,
    pageFetchCount: stats.pageFetchCount,
    matchCount: Array.isArray(matches) ? matches.length : 0,
    match,
    canonicalMatchState,
    canonicalMarketState,
    flashscoreRawStats,
    kalshiDisplayStats,
    resolvedStats,
    prematchBaseline,
    pointRisk,
    probabilityState,
    decisionSnapshot,
  }
}
