import { buildCanonicalMatchState } from '../foundation/canonicalMatchState.js'
import { buildDecisionSnapshot } from '../foundation/decisionSnapshot.js'
import { buildPrematchBaseline } from '../foundation/prematchBaselineBuilder.js'
import { buildPrematchBaselineFromProviders } from '../foundation/prematchBaselineProvider.js'
import type { PrematchBaseline } from '../foundation/prematchBaseline.js'
import { buildResolvedStats } from '../foundation/resolvedStats.js'
import { buildProbabilityState } from '../probability/probabilityState.js'
import { fetchDirectMatchPage as fetchDirectTennisMatchPage } from '../realtime-score/tennis/scoreboardClient.js'
import { evaluateTennisPointRisk } from '../rules/tennis/pointRiskEngine.js'
import { deriveTennisTradePlan } from '../rules/tennis/tradePlan.js'
import type { ServerTennisMatchEnvelope, ServerTennisMatchPayload } from '../server/tennisPayload.js'
import { mapServerPayloadToTennisFeedMatch, unwrapServerTennisMatchPayload } from '../server/tennisPayload.js'

function hasUsableStats(stats: Record<string, unknown> | null | undefined): boolean {
  if (!stats) return false
  return Object.values(stats).some((value) => value != null && String(value).trim() !== '')
}

export interface ExtractFromServerPayloadOptions {
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
  enrichFlashscoreStats?: boolean
}

export async function extractMatchFromServerPayload(
  payload: ServerTennisMatchPayload | ServerTennisMatchEnvelope,
  options?: ExtractFromServerPayloadOptions,
) {
  const rawMatchPayload = unwrapServerTennisMatchPayload(payload)
  const baseMatch = mapServerPayloadToTennisFeedMatch(payload)
  let enrichedFlashscoreStats = baseMatch.stats

  const shouldEnrichFlashscoreStats =
    !!baseMatch.sourcePageUrl && (options?.enrichFlashscoreStats || !hasUsableStats(baseMatch.stats))

  if (shouldEnrichFlashscoreStats) {
    const fetched = await fetchDirectTennisMatchPage(baseMatch.sourcePageUrl, {
      force: true,
      includeRenderedServe: false,
    }).catch(() => [])
    const detailMatch =
      fetched.find((candidate) => String(candidate.eventId || '').trim() === String(baseMatch.eventId || '').trim()) ||
      fetched[0] ||
      null
    if (detailMatch?.stats) {
      enrichedFlashscoreStats = detailMatch.stats
    }
  }

  const match = {
    ...baseMatch,
    stats: enrichedFlashscoreStats,
  }
  const canonicalMatchState = buildCanonicalMatchState(match)
  const resolvedStats = buildResolvedStats({
    flashscore: match.stats,
    kalshi: null,
  })
  const pointRisk = evaluateTennisPointRisk(match)
  const derivedPrematchBaseline =
    options?.prematchBaseline ??
    (
      options?.playerDirectory
        ? (
            await buildPrematchBaselineFromProviders(
              {
                matchState: canonicalMatchState,
                marketImpliedProbA: options?.marketImpliedProbA ?? null,
                marketImpliedProbB: options?.marketImpliedProbB ?? null,
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
            marketImpliedProbA: options?.marketImpliedProbA ?? null,
            marketImpliedProbB: options?.marketImpliedProbB ?? null,
            surface: options?.surface,
          })
    )
  const prematchBaseline = {
    ...derivedPrematchBaseline,
    pointBaselineA: rawMatchPayload.pA ?? derivedPrematchBaseline.pointBaselineA ?? null,
    pointBaselineB: rawMatchPayload.pB ?? derivedPrematchBaseline.pointBaselineB ?? null,
  }
  const probabilityState = buildProbabilityState({
    state: canonicalMatchState,
    pointRisk,
    baseline: prematchBaseline,
    resolvedStats,
  })
  const tradePlan = deriveTennisTradePlan(match, pointRisk)
  const decisionSnapshot = buildDecisionSnapshot({
    canonicalMatchState,
    canonicalMarketState: null,
    kalshiMarketUrl: null,
    polymarketMarketUrl: null,
    kalshiDisplayStats: null,
    resolvedStats,
    prematchBaseline,
    pointRisk,
    probabilityState,
    tradePlan,
  })

  return {
    ok: true,
    match,
    canonicalMatchState,
    resolvedStats,
    prematchBaseline,
    pointRisk,
    probabilityState,
    decisionSnapshot,
  }
}
