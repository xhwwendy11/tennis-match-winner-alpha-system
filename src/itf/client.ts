import type {
  ItfPlayerBaseline,
  ItfPlayerOverviewResponse,
  ItfPlayerWinLossResponse,
} from './types.js'

export interface ItfClientOptions {
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

export function buildItfPlayerBaseline(input: {
  playerId: string | number
  overview: ItfPlayerOverviewResponse
  winLoss: ItfPlayerWinLossResponse
}): ItfPlayerBaseline {
  const overview = input.overview || {}
  const singles = input.winLoss?.winLoss?.singles || {}
  const overall = singles.overall || {}
  const hard = singles.hard || {}
  const clay = singles.clay || {}
  const grass = singles.grass || {}

  return {
    source: 'itf',
    playerId: toNullableString(overview.playerId ?? input.playerId),
    firstName: toNullableString(overview.firstName),
    lastName: toNullableString(overview.lastName),
    fullName: toNullableString(overview.fullName),
    nationality: toNullableString(overview.nationality || overview.nationalityCode),
    age: toNullableNumber(overview.age),
    dateOfBirth: toNullableString(overview.dateOfBirth),
    currentSinglesRank: toNullableNumber(overview.currentSinglesRank),
    currentDoublesRank: toNullableNumber(overview.currentDoublesRank),
    currentCombinedRank: toNullableNumber(overview.currentCombinedRank),
    currentWtnRank: toNullableNumber(overview.currentWtnRank),
    plays: toNullableString(overview.hand),
    height: toNullableString(overview.height),
    overview: {
      overallWon: toNullableNumber(overall.wins),
      overallLost: toNullableNumber(overall.losses),
      overallWinPercentage: toNullableNumber(overall.winPercentage),
      hardWinPercentage: toNullableNumber(hard.winPercentage),
      clayWinPercentage: toNullableNumber(clay.winPercentage),
      grassWinPercentage: toNullableNumber(grass.winPercentage),
    },
    // ITF overview endpoints we have verified do not expose serve/return detail yet.
    serve: {
      aces: null,
      doubleFaults: null,
      firstServePercentage: null,
      firstServePointsWonPercentage: null,
      secondServePointsWonPercentage: null,
      breakPointsSavedPercentage: null,
      servicePointsWonPercentage: null,
      serviceGamesPlayed: null,
      serviceGamesWonPercentage: null,
    },
    return: {
      firstServeReturnPointsWonPercentage: null,
      secondServeReturnPointsWonPercentage: null,
      breakPointsConvertedPercentage: null,
      returnGamesPlayed: null,
      returnGamesWonPercentage: null,
      returnPointsWonPercentage: null,
    },
  }
}

export class ItfClient {
  private readonly baseUrl: string
  private readonly fetchImpl: typeof fetch

  constructor(options: ItfClientOptions = {}) {
    this.baseUrl = String(options.baseUrl || 'https://www.itftennis.com').replace(/\/+$/, '')
    this.fetchImpl = options.fetchImpl || fetch
  }

  async getPlayerOverview(playerId: string | number, options?: {
    circuitCode?: string
    matchTypeCode?: string
  }): Promise<ItfPlayerOverviewResponse> {
    return this.getJson('/tennis/api/PlayerApi/GetPlayerOverview', {
      playerId,
      circuitCode: options?.circuitCode || 'MT',
      matchTypeCode: options?.matchTypeCode || 'S',
    })
  }

  async getPlayerWinLoss(playerId: string | number, options?: {
    circuitCode?: string
    matchTypeCode?: string
    year?: number | string
  }): Promise<ItfPlayerWinLossResponse> {
    return this.getJson('/tennis/api/PlayerApi/GetPlayerWinLoss', {
      playerId,
      circuitCode: options?.circuitCode || 'MT',
      matchTypeCode: options?.matchTypeCode || 'S',
      year: options?.year || new Date().getUTCFullYear(),
    })
  }

  async getPlayerBaseline(playerId: string | number, options?: {
    circuitCode?: string
    matchTypeCode?: string
    year?: number | string
  }): Promise<ItfPlayerBaseline> {
    const [overview, winLoss] = await Promise.all([
      this.getPlayerOverview(playerId, options),
      this.getPlayerWinLoss(playerId, options),
    ])

    return buildItfPlayerBaseline({
      playerId,
      overview,
      winLoss,
    })
  }

  private async getJson<T>(
    path: string,
    query?: Record<string, string | number | boolean | null | undefined>,
  ): Promise<T> {
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
      throw new Error(`ITF request failed: ${response.status} ${response.statusText}`)
    }

    return (await response.json()) as T
  }
}
