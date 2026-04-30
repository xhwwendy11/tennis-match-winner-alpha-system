import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

import type { TennisFeedMatch, TennisFeedTeamStats } from '../realtime-score/tennis/types.js'
import { fetchDirectMatchPage, fetchPlayerResultsMatches } from '../realtime-score/tennis/scoreboardClient.js'

export interface FlashscoreHistoricalPlayerBaseline {
  source: 'flashscore_history'
  playerId: string | null
  slug: string | null
  fullName: string | null
  fetchedAt?: string | null
  sampleMatches: number
  attemptedMatches: number
  serve: {
    firstServePercentage: number | null
    firstServePointsWonPercentage: number | null
    secondServePointsWonPercentage: number | null
    servicePointsWonPercentage: number | null
    serviceGamesPlayed: number | null
    serviceGamesWonPercentage: number | null
  }
  return: {
    firstServeReturnPointsWonPercentage: number | null
    secondServeReturnPointsWonPercentage: number | null
    returnPointsWonPercentage: number | null
    returnGamesPlayed: number | null
    returnGamesWonPercentage: number | null
  }
}

export interface FlashscoreHistoricalBaselineClient {
  getPlayerBaseline(player: { name: string; slug: string; playerId: string }, opts?: FlashscoreHistoricalBaselineOptions): Promise<FlashscoreHistoricalPlayerBaseline | null>
}

export interface FlashscoreHistoricalBaselineOptions {
  maxMatches?: number
  minStatMatches?: number
  force?: boolean
  timeoutMs?: number
}

export interface FlashscoreHistoricalBaselineProviderOptions {
  cacheDir?: string
  cacheOnly?: boolean
}

interface RatioAccumulator {
  made: number
  total: number
}

interface Accumulators {
  firstServe: RatioAccumulator
  firstServeWon: RatioAccumulator
  secondServeWon: RatioAccumulator
  servicePointsWon: RatioAccumulator
  firstServeReturnWon: RatioAccumulator
  secondServeReturnWon: RatioAccumulator
  returnPointsWon: RatioAccumulator
  serviceGamesWon: RatioAccumulator
  returnGamesWon: RatioAccumulator
}

function emptyRatio(): RatioAccumulator {
  return { made: 0, total: 0 }
}

function emptyAccumulators(): Accumulators {
  return {
    firstServe: emptyRatio(),
    firstServeWon: emptyRatio(),
    secondServeWon: emptyRatio(),
    servicePointsWon: emptyRatio(),
    firstServeReturnWon: emptyRatio(),
    secondServeReturnWon: emptyRatio(),
    returnPointsWon: emptyRatio(),
    serviceGamesWon: emptyRatio(),
    returnGamesWon: emptyRatio(),
  }
}

function ratioParts(value: string | null | undefined): RatioAccumulator | null {
  const text = String(value || '').trim()
  const match = text.match(/\((\d+)\s*\/\s*(\d+)\)/) || text.match(/^(\d+)\s*\/\s*(\d+)/)
  if (!match) return null
  const made = Number(match[1])
  const total = Number(match[2])
  if (!Number.isFinite(made) || !Number.isFinite(total) || total <= 0) return null
  return { made, total }
}

function addRatio(target: RatioAccumulator, value: string | null | undefined): boolean {
  const parts = ratioParts(value)
  if (!parts) return false
  target.made += parts.made
  target.total += parts.total
  return true
}

function pct(acc: RatioAccumulator): number | null {
  if (acc.total <= 0) return null
  return (acc.made / acc.total) * 100
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out after ${timeoutMs}ms: ${label}`)), timeoutMs)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        clearTimeout(timer)
        reject(error)
      },
    )
  })
}

function isSinglesMatch(match: TennisFeedMatch): boolean {
  const text = `${match.tournamentPath || ''} ${match.tournamentLabel || ''} ${match.tournamentName || ''}`.toLowerCase()
  if (text.includes('doubles')) return false
  if (String(match.teamA.name || '').includes('/') || String(match.teamB.name || '').includes('/')) return false
  return true
}

function playerSide(match: TennisFeedMatch, player: { slug: string; playerId: string }): 'teamA' | 'teamB' | null {
  if (match.teamA.playerId === player.playerId || match.teamA.slug === player.slug) return 'teamA'
  if (match.teamB.playerId === player.playerId || match.teamB.slug === player.slug) return 'teamB'
  return null
}

function statsForSide(stats: TennisFeedTeamStats, side: 'teamA' | 'teamB') {
  return side === 'teamA'
    ? {
        firstServePercentage: stats.firstServePercentageA,
        firstServeWon: stats.firstServeWonA,
        secondServeWon: stats.secondServeWonA,
        servicePointsWon: stats.servicePointsWonA,
        firstServeReturnPointsWon: stats.firstServeReturnPointsWonA,
        secondServeReturnPointsWon: stats.secondServeReturnPointsWonA,
        returnPointsWon: stats.returnPointsWonA,
        serviceGamesWon: stats.serviceGamesPlayedA,
        returnGamesWon: stats.returnGamesWonA,
      }
    : {
        firstServePercentage: stats.firstServePercentageB,
        firstServeWon: stats.firstServeWonB,
        secondServeWon: stats.secondServeWonB,
        servicePointsWon: stats.servicePointsWonB,
        firstServeReturnPointsWon: stats.firstServeReturnPointsWonB,
        secondServeReturnPointsWon: stats.secondServeReturnPointsWonB,
        returnPointsWon: stats.returnPointsWonB,
        serviceGamesWon: stats.serviceGamesPlayedB,
        returnGamesWon: stats.returnGamesWonB,
      }
}

function accumulateStats(acc: Accumulators, stats: TennisFeedTeamStats, side: 'teamA' | 'teamB'): boolean {
  const values = statsForSide(stats, side)
  let added = false
  added = addRatio(acc.firstServe, values.firstServePercentage) || added
  added = addRatio(acc.firstServeWon, values.firstServeWon) || added
  added = addRatio(acc.secondServeWon, values.secondServeWon) || added
  added = addRatio(acc.servicePointsWon, values.servicePointsWon) || added
  added = addRatio(acc.firstServeReturnWon, values.firstServeReturnPointsWon) || added
  added = addRatio(acc.secondServeReturnWon, values.secondServeReturnPointsWon) || added
  added = addRatio(acc.returnPointsWon, values.returnPointsWon) || added
  added = addRatio(acc.serviceGamesWon, values.serviceGamesWon) || added
  added = addRatio(acc.returnGamesWon, values.returnGamesWon) || added
  return added
}

export async function buildFlashscoreHistoricalPlayerBaseline(
  player: { name: string; slug: string; playerId: string },
  opts: FlashscoreHistoricalBaselineOptions = {},
): Promise<FlashscoreHistoricalPlayerBaseline | null> {
  const maxMatches = Math.max(1, Math.floor(opts.maxMatches ?? 12))
  const minStatMatches = Math.max(1, Math.floor(opts.minStatMatches ?? 2))
  const timeoutMs = Math.max(1000, Math.floor(opts.timeoutMs ?? 8000))
  const history = await withTimeout(
    fetchPlayerResultsMatches(player, { force: opts.force }),
    timeoutMs,
    `player-results:${player.playerId}`,
  )
  const candidates = history
    .filter((match) => match.status === 'FINAL' && !!match.matchUrl && isSinglesMatch(match))
    .filter((match) => playerSide(match, player) != null)
    .slice(0, maxMatches)

  const acc = emptyAccumulators()
  let sampleMatches = 0

  for (const candidate of candidates) {
    if (!candidate.matchUrl) continue
    let details: TennisFeedMatch[]
    try {
      details = await withTimeout(
        fetchDirectMatchPage(candidate.matchUrl, {
          force: opts.force,
          includeRenderedServe: false,
        }),
        timeoutMs,
        `match-detail:${candidate.eventId}`,
      )
    } catch {
      continue
    }
    const detail = details.find((match) => match.eventId === candidate.eventId) || details[0] || null
    const side = detail ? playerSide(detail, player) : playerSide(candidate, player)
    const stats = detail?.stats || candidate.stats
    if (!side || !stats) continue
    if (accumulateStats(acc, stats, side)) sampleMatches += 1
    if (sampleMatches >= minStatMatches) break
  }

  if (sampleMatches < minStatMatches) return null

  return {
    source: 'flashscore_history',
    playerId: player.playerId || null,
    slug: player.slug || null,
    fullName: player.name || null,
    sampleMatches,
    attemptedMatches: candidates.length,
    serve: {
      firstServePercentage: pct(acc.firstServe),
      firstServePointsWonPercentage: pct(acc.firstServeWon),
      secondServePointsWonPercentage: pct(acc.secondServeWon),
      servicePointsWonPercentage: pct(acc.servicePointsWon),
      serviceGamesPlayed: acc.serviceGamesWon.total || null,
      serviceGamesWonPercentage: pct(acc.serviceGamesWon),
    },
    return: {
      firstServeReturnPointsWonPercentage: pct(acc.firstServeReturnWon),
      secondServeReturnPointsWonPercentage: pct(acc.secondServeReturnWon),
      returnPointsWonPercentage: pct(acc.returnPointsWon),
      returnGamesPlayed: acc.returnGamesWon.total || null,
      returnGamesWonPercentage: pct(acc.returnGamesWon),
    },
  }
}

export class FlashscoreHistoricalBaselineProvider implements FlashscoreHistoricalBaselineClient {
  private readonly cacheDir: string | null
  private readonly cacheOnly: boolean

  constructor(options: FlashscoreHistoricalBaselineProviderOptions = {}) {
    this.cacheDir = options.cacheDir ?? null
    this.cacheOnly = options.cacheOnly ?? false
  }

  private cachePath(playerId: string): string | null {
    if (!this.cacheDir) return null
    const safeId = String(playerId || '').replace(/[^a-zA-Z0-9_-]+/g, '_')
    return safeId ? path.join(this.cacheDir, `${safeId}.json`) : null
  }

  private async readCached(playerId: string): Promise<FlashscoreHistoricalPlayerBaseline | null> {
    const cachePath = this.cachePath(playerId)
    if (!cachePath) return null
    try {
      return JSON.parse(await readFile(cachePath, 'utf8')) as FlashscoreHistoricalPlayerBaseline
    } catch {
      return null
    }
  }

  private async writeCached(playerId: string, baseline: FlashscoreHistoricalPlayerBaseline): Promise<void> {
    const cachePath = this.cachePath(playerId)
    if (!cachePath) return
    await mkdir(path.dirname(cachePath), { recursive: true })
    await writeFile(cachePath, `${JSON.stringify(baseline, null, 2)}\n`, 'utf8')
  }

  async getPlayerBaseline(
    player: { name: string; slug: string; playerId: string },
    opts?: FlashscoreHistoricalBaselineOptions,
  ): Promise<FlashscoreHistoricalPlayerBaseline | null> {
    const cached = await this.readCached(player.playerId)
    if (cached && !opts?.force) return cached
    if (this.cacheOnly) return cached

    const baseline = await buildFlashscoreHistoricalPlayerBaseline(player, opts)
    if (!baseline) return null
    const withTimestamp = {
      ...baseline,
      fetchedAt: new Date().toISOString(),
    }
    await this.writeCached(player.playerId, withTimestamp)
    return withTimestamp
  }
}
