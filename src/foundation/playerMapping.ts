import { normalizeName } from '../realtime-score/tennis/mapper.js'
import type { CanonicalMatchState, TourType } from './canonicalMatchState.js'

export type PlayerSource = 'atp' | 'wta' | 'itf'

export interface PlayerDirectoryEntry {
  source: PlayerSource
  sourcePlayerId: string
  flashscorePlayerId?: string | null
  flashscoreSlug?: string | null
  fullName: string
  aliases?: string[]
  meta?: {
    circuitCode?: string | null
    matchTypeCode?: string | null
  }
}

export interface PlayerMapping {
  source: PlayerSource
  sourcePlayerId: string
  matchedBy: 'flashscore_player_id' | 'flashscore_slug' | 'full_name' | 'alias'
  fullName: string
  meta?: PlayerDirectoryEntry['meta']
}

export interface MatchPlayerMappings {
  preferredSource: PlayerSource | null
  teamA: PlayerMapping | null
  teamB: PlayerMapping | null
}

function preferredSourceForTour(tourType: TourType): PlayerSource | null {
  if (tourType === 'ATP' || tourType === 'ATP_CHALLENGER') return 'atp'
  if (tourType === 'WTA' || tourType === 'WTA_CHALLENGER') return 'wta'
  if (tourType === 'ITF') return 'itf'
  return null
}

function candidateNames(player: CanonicalMatchState['participants']['teamA']): string[] {
  return [player.name, player.shortName, ...(player.slug ? [player.slug.replace(/-/g, ' ')] : [])]
    .map((value) => String(value || '').trim())
    .filter(Boolean)
}

function matchEntry(
  player: CanonicalMatchState['participants']['teamA'],
  preferredSource: PlayerSource | null,
  directory: PlayerDirectoryEntry[],
): PlayerMapping | null {
  const sourceScoped = preferredSource
    ? directory.filter((entry) => entry.source === preferredSource)
    : directory

  if (player.playerId) {
    const byPlayerId = sourceScoped.find((entry) => entry.flashscorePlayerId === player.playerId)
    if (byPlayerId) {
      return {
        source: byPlayerId.source,
        sourcePlayerId: byPlayerId.sourcePlayerId,
        matchedBy: 'flashscore_player_id',
        fullName: byPlayerId.fullName,
        meta: byPlayerId.meta,
      }
    }
  }

  if (player.slug) {
    const bySlug = sourceScoped.find((entry) => entry.flashscoreSlug === player.slug)
    if (bySlug) {
      return {
        source: bySlug.source,
        sourcePlayerId: bySlug.sourcePlayerId,
        matchedBy: 'flashscore_slug',
        fullName: bySlug.fullName,
        meta: bySlug.meta,
      }
    }
  }

  const normalizedCandidates = new Set(candidateNames(player).map((value) => normalizeName(value)).filter(Boolean))
  if (normalizedCandidates.size === 0) return null

  for (const entry of sourceScoped) {
    const fullName = normalizeName(entry.fullName)
    if (fullName && normalizedCandidates.has(fullName)) {
      return {
        source: entry.source,
        sourcePlayerId: entry.sourcePlayerId,
        matchedBy: 'full_name',
        fullName: entry.fullName,
        meta: entry.meta,
      }
    }

    for (const alias of entry.aliases || []) {
      const normalizedAlias = normalizeName(alias)
      if (normalizedAlias && normalizedCandidates.has(normalizedAlias)) {
        return {
          source: entry.source,
          sourcePlayerId: entry.sourcePlayerId,
          matchedBy: 'alias',
          fullName: entry.fullName,
          meta: entry.meta,
        }
      }
    }
  }

  return null
}

export function buildMatchPlayerMappings(
  state: CanonicalMatchState | null,
  directory: PlayerDirectoryEntry[],
): MatchPlayerMappings {
  const preferredSource = preferredSourceForTour(state?.competition.tourType ?? 'UNKNOWN')
  if (!state) {
    return {
      preferredSource,
      teamA: null,
      teamB: null,
    }
  }

  return {
    preferredSource,
    teamA: matchEntry(state.participants.teamA, preferredSource, directory),
    teamB: matchEntry(state.participants.teamB, preferredSource, directory),
  }
}
