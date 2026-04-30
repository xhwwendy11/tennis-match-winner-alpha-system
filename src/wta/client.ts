import type { WtaPlayerBaseline, WtaPlayerYearResponse } from './types.js'

export interface WtaClientOptions {
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

function firstNumber(...values: unknown[]): number | null {
  for (const value of values) {
    const parsed = toNullableNumber(value)
    if (parsed != null) return parsed
  }
  return null
}

export function buildWtaPlayerBaseline(input: {
  playerId: string | number
  year: number
  payload: WtaPlayerYearResponse
}): WtaPlayerBaseline {
  const payload = input.payload || {}
  const player = payload.player || {}
  const overview = payload.overview || {}
  const stats = payload.stats || {}
  const serve = payload.servingStats || {}
  const ret = payload.returnStats || {}

  return {
    source: 'wta',
    playerId: toNullableString(player.id ?? input.playerId),
    firstName: toNullableString(player.firstName),
    lastName: toNullableString(player.lastName),
    countryCode: toNullableString(player.countryCode),
    dateOfBirth: toNullableString(player.dateOfBirth),
    turnedPro: toNullableNumber(player.turnedPro),
    plays: toNullableString(player.plays),
    currentSinglesRanking: firstNumber(player.currentSinglesRanking, stats.Current_Rank),
    year: input.year,
    overview: {
      wonLost: toNullableString(overview.wonLost),
      singlesTitles: toNullableNumber(overview.singlesTitles),
      prizeMoney: toNullableString(overview.prizeMoney),
    },
    serve: {
      aces: firstNumber(serve.aces, stats.aces, stats.Aces),
      doubleFaults: firstNumber(serve.doubleFaults, stats.Double_Faults),
      firstServePercentage: firstNumber(serve.firstServePercentage, stats.first_serve_percent),
      firstServeWonPercentage: firstNumber(serve.firstServeWon, stats.first_serve_won_percent),
      secondServeWonPercentage: firstNumber(serve.secondServeWon, stats.second_serve_won_percent),
      breakPointsSavedPercentage: firstNumber(serve.breakPointsSaved, stats.breakpoint_saved_percent),
      servicePointsWonPercentage: firstNumber(serve.servicePointsWon, stats.service_points_won_percent),
      serviceGamesWonPercentage: firstNumber(serve.serviceGamesWon, stats.serviceGamesWon, stats.service_games_won_percent),
      serviceGamesPlayed: firstNumber(serve.serviceGamesPlayed, stats.Service_Games_Played),
    },
    return: {
      returnPointsWonPercentage: firstNumber(ret.returnPointsWon, stats.return_points_won_percent),
      firstReturnPointsWonPercentage: firstNumber(ret.firstReturnPointsWon, stats.first_return_percent),
      secondReturnPointsWonPercentage: firstNumber(ret.secondReturnPointsWon, stats.second_return_percent),
      breakPointsConvertedPercentage: firstNumber(ret.breakPointsConverted, stats.breakpoint_converted_percent),
      returnGamesWonPercentage: firstNumber(ret.returnGamesWon, stats.returnGamesWon, stats.return_games_won_percent),
      returnGamesPlayed: firstNumber(ret.returnGamesPlayed, stats.Return_Games_Played),
    },
  }
}

export class WtaClient {
  private readonly baseUrl: string
  private readonly fetchImpl: typeof fetch

  constructor(options: WtaClientOptions = {}) {
    this.baseUrl = String(options.baseUrl || 'https://api.wtatennis.com').replace(/\/+$/, '')
    this.fetchImpl = options.fetchImpl || fetch
  }

  async getPlayerYear(playerId: string | number, year: number): Promise<WtaPlayerYearResponse> {
    return this.getJson(`/tennis/players/${encodeURIComponent(String(playerId))}/year/${encodeURIComponent(String(year))}`)
  }

  async getPlayerBaseline(playerId: string | number, year: number): Promise<WtaPlayerBaseline> {
    const payload = await this.getPlayerYear(playerId, year)
    return buildWtaPlayerBaseline({ playerId, year, payload })
  }

  private async getJson<T>(path: string): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`)
    const response = await this.fetchImpl(url.toString(), {
      method: 'GET',
      headers: {
        accept: 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`WTA request failed: ${response.status} ${response.statusText}`)
    }

    return (await response.json()) as T
  }
}
