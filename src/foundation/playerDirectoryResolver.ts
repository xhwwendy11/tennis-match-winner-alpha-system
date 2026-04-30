import type { CanonicalMatchState } from './canonicalMatchState.js'
import { buildMatchPlayerMappings, type MatchPlayerMappings, type PlayerDirectoryEntry, type PlayerSource } from './playerMapping.js'
import type { AtpDirectoryClient } from '../atp/directoryClient.js'
import type { WtaDirectoryClient } from '../wta/directoryClient.js'
import type { ItfDirectoryClient } from '../itf/directoryClient.js'

export interface PlayerDirectoryResolverOptions {
  directory: PlayerDirectoryEntry[]
  atpDirectoryClient?: Pick<AtpDirectoryClient, 'findPlayerByExactName'> | null
  wtaDirectoryClient?: Pick<WtaDirectoryClient, 'findPlayerByExactName'> | null
  itfDirectoryClient?: Pick<ItfDirectoryClient, 'findPlayerByExactName'> | null
  persistDiscoveredEntries?: ((entries: PlayerDirectoryEntry[]) => void | Promise<void>) | null
}

export interface PlayerDirectoryResolverResult {
  mappings: MatchPlayerMappings
  discoveredEntries: PlayerDirectoryEntry[]
  directory: PlayerDirectoryEntry[]
}

function preferredSourceForState(state: CanonicalMatchState | null): PlayerSource | null {
  const tourType = state?.competition.tourType ?? 'UNKNOWN'
  if (tourType === 'ATP' || tourType === 'ATP_CHALLENGER') return 'atp'
  if (tourType === 'WTA' || tourType === 'WTA_CHALLENGER') return 'wta'
  if (tourType === 'ITF') return 'itf'
  return null
}

function buildDiscoveredEntry(input: {
  source: PlayerSource
  sourcePlayerId: string
  player: CanonicalMatchState['participants']['teamA']
  fullName: string
}): PlayerDirectoryEntry {
  const aliases = [input.player.name, input.player.shortName]
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .filter((value, index, list) => list.indexOf(value) === index && value !== input.fullName)

  return {
    source: input.source,
    sourcePlayerId: input.sourcePlayerId,
    flashscorePlayerId: input.player.playerId || null,
    flashscoreSlug: input.player.slug || null,
    fullName: input.fullName,
    aliases: aliases.length > 0 ? aliases : undefined,
  }
}

export async function resolvePlayerDirectoryMappings(
  state: CanonicalMatchState | null,
  options: PlayerDirectoryResolverOptions,
): Promise<PlayerDirectoryResolverResult> {
  const directory = [...options.directory]
  const discoveredEntries: PlayerDirectoryEntry[] = []

  let mappings = buildMatchPlayerMappings(state, directory)
  const preferredSource = preferredSourceForState(state)

  if (state && preferredSource) {
    const missingTeams: Array<{ side: 'teamA' | 'teamB'; player: CanonicalMatchState['participants']['teamA'] }> = []
    if (!mappings.teamA) missingTeams.push({ side: 'teamA', player: state.participants.teamA })
    if (!mappings.teamB) missingTeams.push({ side: 'teamB', player: state.participants.teamB })

    for (const item of missingTeams) {
      const found =
        preferredSource === 'atp'
          ? await options.atpDirectoryClient?.findPlayerByExactName(item.player.name)
          : preferredSource === 'wta'
            ? await options.wtaDirectoryClient?.findPlayerByExactName(item.player.name)
            : await options.itfDirectoryClient?.findPlayerByExactName(item.player.name)
      if (!found) continue

      const entry = buildDiscoveredEntry({
        source: preferredSource,
        sourcePlayerId: found.playerId,
        player: item.player,
        fullName: found.name,
      })
      if (preferredSource === 'itf' && found.meta) {
        entry.meta = {
          circuitCode: found.meta.circuitCode || null,
          matchTypeCode: found.meta.matchTypeCode || null,
        }
      }
      directory.push(entry)
      discoveredEntries.push(entry)
    }

    if (discoveredEntries.length > 0 && options.persistDiscoveredEntries) {
      await options.persistDiscoveredEntries(discoveredEntries)
    }

    mappings = buildMatchPlayerMappings(state, directory)
  }

  return {
    mappings,
    discoveredEntries,
    directory,
  }
}
