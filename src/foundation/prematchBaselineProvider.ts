import type { AtpClient } from '../atp/client.js'
import type { AtpPlayerBaseline } from '../atp/types.js'
import type { ItfClient } from '../itf/client.js'
import type { ItfPlayerBaseline } from '../itf/types.js'
import type { WtaClient } from '../wta/client.js'
import type { WtaPlayerBaseline } from '../wta/types.js'
import type { CanonicalMatchState } from './canonicalMatchState.js'
import { type MatchPlayerMappings, type PlayerDirectoryEntry } from './playerMapping.js'
import { buildPrematchBaseline } from './prematchBaselineBuilder.js'
import type { PrematchBaseline } from './prematchBaseline.js'
import { resolvePlayerDirectoryMappings } from './playerDirectoryResolver.js'
import type { AtpDirectoryClient } from '../atp/directoryClient.js'
import type { WtaDirectoryClient } from '../wta/directoryClient.js'
import type { ItfDirectoryClient } from '../itf/directoryClient.js'
import type { BaselineCache, BaselineCacheKey, PlayerBaseline } from './baselineCache.js'
import type { FlashscoreHistoricalBaselineClient, FlashscoreHistoricalPlayerBaseline } from '../flashscore/historicalBaseline.js'

export interface PrematchBaselineProviderOptions {
  directory: PlayerDirectoryEntry[]
  atpClient?: Pick<AtpClient, 'getPlayerBaseline'> | null
  atpDirectoryClient?: Pick<AtpDirectoryClient, 'findPlayerByExactName'> | null
  wtaClient?: Pick<WtaClient, 'getPlayerBaseline'> | null
  wtaDirectoryClient?: Pick<WtaDirectoryClient, 'findPlayerByExactName'> | null
  itfClient?: Pick<ItfClient, 'getPlayerBaseline'> | null
  itfDirectoryClient?: Pick<ItfDirectoryClient, 'findPlayerByExactName'> | null
  persistDiscoveredEntries?: ((entries: PlayerDirectoryEntry[]) => void | Promise<void>) | null
  baselineCache?: BaselineCache | null
  flashscoreHistoricalBaselineClient?: FlashscoreHistoricalBaselineClient | null
  historicalMaxMatches?: number | null
  historicalMinStatMatches?: number | null
}

export interface PrematchBaselineProviderInput {
  matchState: CanonicalMatchState | null
  marketImpliedProbA?: number | null
  marketImpliedProbB?: number | null
  surface?: PrematchBaseline['surface'] | null
}

export interface PrematchBaselineProviderResult {
  mappings: MatchPlayerMappings
  playerA: AtpPlayerBaseline | WtaPlayerBaseline | ItfPlayerBaseline | FlashscoreHistoricalPlayerBaseline | null
  playerB: AtpPlayerBaseline | WtaPlayerBaseline | ItfPlayerBaseline | FlashscoreHistoricalPlayerBaseline | null
  prematchBaseline: PrematchBaseline
}

function baselineYearFor(state: CanonicalMatchState | null): number {
  const iso = String(state?.competition.startTimeISO || '').trim()
  const year = iso ? Number(new Date(iso).getUTCFullYear()) : NaN
  return Number.isFinite(year) && year > 2000 ? year : new Date().getUTCFullYear()
}

async function fetchMappedPlayerBaseline(input: {
  mapping: MatchPlayerMappings['teamA']
  year: number
  atpClient?: Pick<AtpClient, 'getPlayerBaseline'> | null
  wtaClient?: Pick<WtaClient, 'getPlayerBaseline'> | null
  itfClient?: Pick<ItfClient, 'getPlayerBaseline'> | null
  baselineCache?: BaselineCache | null
}): Promise<AtpPlayerBaseline | WtaPlayerBaseline | ItfPlayerBaseline | null> {
  const mapping = input.mapping
  if (!mapping) return null

  const cacheKey: BaselineCacheKey =
    mapping.source === 'atp'
      ? {
          source: 'atp',
          sourcePlayerId: mapping.sourcePlayerId,
          year: 'all',
          surface: 'all',
        }
      : mapping.source === 'wta'
        ? {
            source: 'wta',
            sourcePlayerId: mapping.sourcePlayerId,
            year: input.year,
          }
        : {
            source: 'itf',
            sourcePlayerId: mapping.sourcePlayerId,
            year: input.year,
            circuitCode: mapping.meta?.circuitCode || null,
            matchTypeCode: mapping.meta?.matchTypeCode || null,
          }

  const cached = await input.baselineCache?.get(cacheKey)
  if (cached) return cached.baseline as AtpPlayerBaseline | WtaPlayerBaseline | ItfPlayerBaseline

  let baseline: PlayerBaseline | null = null

  if (mapping.source === 'atp') {
    if (!input.atpClient) return null
    baseline = await input.atpClient.getPlayerBaseline(mapping.sourcePlayerId, {
      year: 'all',
      surface: 'all',
    })
  } else if (mapping.source === 'wta') {
    if (!input.wtaClient) return null
    baseline = await input.wtaClient.getPlayerBaseline(mapping.sourcePlayerId, input.year)
  } else {
    if (!input.itfClient) return null
    baseline = await input.itfClient.getPlayerBaseline(mapping.sourcePlayerId, {
      circuitCode: mapping.meta?.circuitCode || undefined,
      matchTypeCode: mapping.meta?.matchTypeCode || undefined,
    })
  }

  await input.baselineCache?.set({
    key: cacheKey,
    baseline,
    fetchedAt: new Date().toISOString(),
  })

  return baseline as AtpPlayerBaseline | WtaPlayerBaseline | ItfPlayerBaseline
}

function hasServeReturnBaseline(player: AtpPlayerBaseline | WtaPlayerBaseline | ItfPlayerBaseline | FlashscoreHistoricalPlayerBaseline | null): boolean {
  if (!player) return false
  const serviceGamesPlayed = player.serve.serviceGamesPlayed
  const returnGamesPlayed = player.return.returnGamesPlayed
  const serviceGamesWonPercentage = player.serve.serviceGamesWonPercentage
  const returnGamesWonPercentage = player.return.returnGamesWonPercentage
  return (
    typeof serviceGamesWonPercentage === 'number' &&
    typeof returnGamesWonPercentage === 'number' &&
    serviceGamesPlayed !== 0 &&
    returnGamesPlayed !== 0
  )
}

function flashscorePlayerSlugFromMatchUrl(matchUrl: string | null | undefined, playerId: string | null | undefined): string | null {
  const id = String(playerId || '').trim()
  if (!id) return null
  try {
    const parsed = new URL(String(matchUrl || ''))
    const parts = parsed.pathname.split('/').filter(Boolean)
    for (const part of parts.slice(2)) {
      if (!part.endsWith(`-${id}`)) continue
      return part.slice(0, -id.length - 1) || null
    }
  } catch {
    return null
  }
  return null
}

async function fetchHistoricalBaseline(input: {
  matchState: CanonicalMatchState | null
  side: 'teamA' | 'teamB'
  client?: FlashscoreHistoricalBaselineClient | null
  maxMatches?: number | null
  minStatMatches?: number | null
}): Promise<FlashscoreHistoricalPlayerBaseline | null> {
  const participant = input.side === 'teamA' ? input.matchState?.participants.teamA : input.matchState?.participants.teamB
  if (!input.client || !participant?.playerId) return null
  const urlSlug = flashscorePlayerSlugFromMatchUrl(input.matchState?.source.matchUrl, participant.playerId)
  const slug = urlSlug || participant.slug
  if (!slug) return null
  return input.client.getPlayerBaseline(
    {
      name: participant.name,
      slug,
      playerId: participant.playerId,
    },
    {
      maxMatches: input.maxMatches ?? undefined,
      minStatMatches: input.minStatMatches ?? undefined,
    },
  ).catch(() => null)
}

export async function buildPrematchBaselineFromProviders(
  input: PrematchBaselineProviderInput,
  options: PrematchBaselineProviderOptions,
): Promise<PrematchBaselineProviderResult> {
  const resolved = await resolvePlayerDirectoryMappings(input.matchState, {
    directory: options.directory,
    atpDirectoryClient: options.atpDirectoryClient,
    wtaDirectoryClient: options.wtaDirectoryClient,
    itfDirectoryClient: options.itfDirectoryClient,
    persistDiscoveredEntries: options.persistDiscoveredEntries,
  })
  const mappings = resolved.mappings
  const year = baselineYearFor(input.matchState)

  const [officialPlayerA, officialPlayerB] = await Promise.all([
    fetchMappedPlayerBaseline({
      mapping: mappings.teamA,
      year,
      atpClient: options.atpClient,
      wtaClient: options.wtaClient,
      itfClient: options.itfClient,
      baselineCache: options.baselineCache,
    }),
    fetchMappedPlayerBaseline({
      mapping: mappings.teamB,
      year,
      atpClient: options.atpClient,
      wtaClient: options.wtaClient,
      itfClient: options.itfClient,
      baselineCache: options.baselineCache,
    }),
  ])

  const [historicalPlayerA, historicalPlayerB] = await Promise.all([
    hasServeReturnBaseline(officialPlayerA)
      ? Promise.resolve(null)
      : fetchHistoricalBaseline({
          matchState: input.matchState,
          side: 'teamA',
          client: options.flashscoreHistoricalBaselineClient,
          maxMatches: options.historicalMaxMatches,
          minStatMatches: options.historicalMinStatMatches,
        }),
    hasServeReturnBaseline(officialPlayerB)
      ? Promise.resolve(null)
      : fetchHistoricalBaseline({
          matchState: input.matchState,
          side: 'teamB',
          client: options.flashscoreHistoricalBaselineClient,
          maxMatches: options.historicalMaxMatches,
          minStatMatches: options.historicalMinStatMatches,
        }),
  ])

  const playerA = hasServeReturnBaseline(officialPlayerA) ? officialPlayerA : historicalPlayerA || officialPlayerA
  const playerB = hasServeReturnBaseline(officialPlayerB) ? officialPlayerB : historicalPlayerB || officialPlayerB

  const prematchBaseline = buildPrematchBaseline({
    matchState: input.matchState,
    playerA,
    playerB,
    marketImpliedProbA: input.marketImpliedProbA,
    marketImpliedProbB: input.marketImpliedProbB,
    surface: input.surface,
  })

  return {
    mappings,
    playerA,
    playerB,
    prematchBaseline,
  }
}
