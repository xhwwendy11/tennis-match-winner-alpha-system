import type { AtpPlayerBaseline, AtpPlayerHeroResponse, AtpPlayerStatsResponse } from './types.js'

export interface AtpClientOptions {
  baseUrl?: string
  fetchImpl?: typeof fetch
}

function toNullableNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function toNullableString(value: unknown): string | null {
  const text = String(value ?? '').trim()
  return text ? text : null
}

export function buildAtpPlayerBaseline(input: {
  hero: AtpPlayerHeroResponse
  stats: AtpPlayerStatsResponse
}): AtpPlayerBaseline {
  const hero = input.hero || {}
  const stats = input.stats || {}
  const payload = stats.Stats || {}
  const serve = payload.ServiceRecordStats || {}
  const ret = payload.ReturnRecordStats || {}

  return {
    source: 'atp',
    playerId: toNullableString(payload.PlayerId),
    firstName: toNullableString(hero.FirstName),
    lastName: toNullableString(hero.LastName),
    nationality: toNullableString(hero.Nationality || hero.NatlId),
    age: toNullableNumber(hero.Age),
    plays: toNullableString(hero.Plays),
    turnedPro: toNullableNumber(hero.TurnedPro),
    heightCm: toNullableNumber(hero.HeightCm),
    statYearFrom: toNullableNumber(stats.FirstStatYear),
    statYearTo: toNullableNumber(stats.LastStatYear),
    category: toNullableString(payload.Category),
    surface: toNullableString(payload.Surface),
    rankDate: toNullableString(payload.RankDate),
    serve: {
      aces: toNullableNumber(serve.Aces),
      doubleFaults: toNullableNumber(serve.DoubleFaults),
      firstServePercentage: toNullableNumber(serve.FirstServePercentage),
      firstServePointsWonPercentage: toNullableNumber(serve.FirstServePointsWonPercentage),
      secondServePointsWonPercentage: toNullableNumber(serve.SecondServePointsWonPercentage),
      breakPointsFaced: toNullableNumber(serve.BreakPointsFaced),
      breakPointsSavedPercentage: toNullableNumber(serve.BreakPointsSavedPercentage),
      serviceGamesPlayed: toNullableNumber(serve.ServiceGamesPlayed),
      serviceGamesWonPercentage: toNullableNumber(serve.ServiceGamesWonPercentage),
      totalServicePointsWonPercentage: toNullableNumber(serve.TotalServicePointsWonPercentage),
    },
    return: {
      firstServeReturnPointsWonPercentage: toNullableNumber(ret.FirstServeReturnPointsWonPercentage),
      secondServeReturnPointsWonPercentage: toNullableNumber(ret.SecondServeReturnPointsWonPercentage),
      breakPointsOpportunities: toNullableNumber(ret.BreakPointsOpportunities),
      breakPointsConvertedPercentage: toNullableNumber(ret.BreakPointsConvertedPercentage),
      returnGamesPlayed: toNullableNumber(ret.ReturnGamesPlayed),
      returnGamesWonPercentage: toNullableNumber(ret.ReturnGamesWonPercentage),
      returnPointsWonPercentage: toNullableNumber(ret.ReturnPointsWonPercentage),
      totalPointsWonPercentage: toNullableNumber(ret.TotalPointsWonPercentage),
    },
  }
}

export class AtpClient {
  private readonly baseUrl: string
  private readonly fetchImpl: typeof fetch

  constructor(options: AtpClientOptions = {}) {
    this.baseUrl = String(options.baseUrl || 'https://www.atptour.com').replace(/\/+$/, '')
    this.fetchImpl = options.fetchImpl || fetch
  }

  async getPlayerHero(playerId: string): Promise<AtpPlayerHeroResponse> {
    return this.getJson(`/en/-/www/players/hero/${encodeURIComponent(playerId.toLowerCase())}`, { v: 1 })
  }

  async getPlayerStats(playerId: string, options?: { year?: string; surface?: string }): Promise<AtpPlayerStatsResponse> {
    const year = String(options?.year || 'all').toLowerCase()
    const surface = String(options?.surface || 'all').toLowerCase()
    return this.getJson(`/en/-/www/stats/${encodeURIComponent(playerId.toLowerCase())}/${year}/${surface}`, { v: 1 })
  }

  async getPlayerBaseline(playerId: string, options?: { year?: string; surface?: string }): Promise<AtpPlayerBaseline> {
    const [hero, stats] = await Promise.all([
      this.getPlayerHero(playerId),
      this.getPlayerStats(playerId, options),
    ])
    return buildAtpPlayerBaseline({ hero, stats })
  }

  private async getJson<T>(path: string, query?: Record<string, string | number | boolean | null | undefined>): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`)
    for (const [key, value] of Object.entries(query || {})) {
      if (value == null) continue
      url.searchParams.set(key, String(value))
    }

    const response = await this.fetchImpl(url.toString(), {
      method: 'GET',
      headers: {
        accept: 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`ATP request failed: ${response.status} ${response.statusText}`)
    }

    return (await response.json()) as T
  }
}

