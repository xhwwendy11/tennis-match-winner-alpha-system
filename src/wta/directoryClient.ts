import { normalizeName } from '../realtime-score/tennis/mapper.js'

export interface WtaDirectoryPlayer {
  playerId: string
  name: string
  profileUrl?: string | null
}

export interface WtaDirectoryClient {
  findPlayerByExactName(name: string): Promise<WtaDirectoryPlayer | null>
}

export interface WtaOfficialDirectoryClientOptions {
  baseUrl?: string
  apiBaseUrl?: string
  fetchImpl?: typeof fetch
}

function toNullableString(value: unknown): string | null {
  const text = String(value ?? '').trim()
  return text ? text : null
}

function parsePlayersPage(html: string): WtaDirectoryPlayer[] {
  const players: WtaDirectoryPlayer[] = []
  const pattern =
    /<div[^>]+class="players-list__item[\s\S]*?data-player-id="(\d+)"[\s\S]*?data-player-name="([^"]+)"[\s\S]*?<a[^>]+class="players-list__url"[^>]+href="([^"]+)"/gi

  let match: RegExpExecArray | null
  while ((match = pattern.exec(html)) !== null) {
    const playerId = toNullableString(match[1])
    const name = toNullableString(match[2])
    const profileUrl = toNullableString(match[3])
    if (!playerId || !name) continue

    players.push({
      playerId,
      name,
      profileUrl,
    })
  }

  return players
}

interface WtaRankedPlayerRow {
  player?: {
    id?: string | number | null
    firstName?: string | null
    lastName?: string | null
    fullName?: string | null
  } | null
}

function parseRankedPlayers(payload: unknown): WtaDirectoryPlayer[] {
  if (!Array.isArray(payload)) return []

  return payload
    .map((row) => {
      const item = row as WtaRankedPlayerRow
      const player = item.player || {}
      const playerId = toNullableString(player.id)
      const fullName = toNullableString(player.fullName)
      const firstName = toNullableString(player.firstName)
      const lastName = toNullableString(player.lastName)
      const name = fullName || [firstName, lastName].filter(Boolean).join(' ').trim()
      if (!playerId || !name) return null

      const slug = normalizeName(name).replace(/\s+/g, '-')
      return {
        playerId,
        name,
        profileUrl: `/players/${playerId}/${slug}`,
      }
    })
    .filter((value): value is WtaDirectoryPlayer => value != null)
}

export class WtaOfficialDirectoryClient implements WtaDirectoryClient {
  private readonly baseUrl: string
  private readonly apiBaseUrl: string
  private readonly fetchImpl: typeof fetch

  constructor(options: WtaOfficialDirectoryClientOptions = {}) {
    this.baseUrl = String(options.baseUrl || 'https://www.wtatennis.com').replace(/\/+$/, '')
    this.apiBaseUrl = String(options.apiBaseUrl || 'https://api.wtatennis.com').replace(/\/+$/, '')
    this.fetchImpl = options.fetchImpl || fetch
  }

  async searchRankedPlayers(name: string): Promise<WtaDirectoryPlayer[]> {
    const normalized = normalizeName(name)
    if (!normalized) return []

    const url = new URL(`${this.apiBaseUrl}/tennis/players/ranked`)
    url.searchParams.set('name', name)
    url.searchParams.set('page', '0')
    url.searchParams.set('pageSize', '20')
    url.searchParams.set('type', 'rankSingles')
    url.searchParams.set('metric', 'SINGLES')
    url.searchParams.set('sort', 'asc')
    url.searchParams.set('at', new Date().toISOString().slice(0, 10))

    const response = await this.fetchImpl(url.toString(), {
      method: 'GET',
      headers: {
        accept: 'application/json',
        account: 'wta',
      },
    })

    if (!response.ok) {
      throw new Error(`WTA ranked players request failed: ${response.status} ${response.statusText}`)
    }

    return parseRankedPlayers(await response.json())
  }

  async listPlayers(): Promise<WtaDirectoryPlayer[]> {
    const response = await this.fetchImpl(`${this.baseUrl}/players`, {
      method: 'GET',
      headers: {
        accept: 'text/html,application/xhtml+xml',
      },
    })

    if (!response.ok) {
      throw new Error(`WTA players page request failed: ${response.status} ${response.statusText}`)
    }

    const html = await response.text()
    return parsePlayersPage(html)
  }

  async findPlayerByExactName(name: string): Promise<WtaDirectoryPlayer | null> {
    const normalized = normalizeName(name)
    if (!normalized) return null

    const rankedPlayers = await this.searchRankedPlayers(name)
    const rankedMatch = rankedPlayers.find((player) => normalizeName(player.name) === normalized)
    if (rankedMatch) return rankedMatch

    const players = await this.listPlayers()
    return players.find((player) => normalizeName(player.name) === normalized) ?? null
  }
}

export { parsePlayersPage as parseWtaPlayersPage, parseRankedPlayers as parseWtaRankedPlayers }
