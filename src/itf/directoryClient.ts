import { normalizeName } from '../realtime-score/tennis/mapper.js'

export interface ItfDirectoryPlayer {
  playerId: string
  name: string
  meta?: {
    circuitCode?: string | null
    matchTypeCode?: string | null
  }
  profileUrl?: string | null
}

export interface ItfDirectoryClient {
  findPlayerByExactName(name: string): Promise<ItfDirectoryPlayer | null>
}

export interface ItfOfficialDirectoryClientOptions {
  baseUrl?: string
  fetchImpl?: typeof fetch
}

function toNullableString(value: unknown): string | null {
  const text = String(value ?? '').trim()
  return text ? text : null
}

function isIncapsulaBlockPage(html: string): boolean {
  return html.includes('_Incapsula_Resource') || html.includes('Incapsula incident ID')
}

function titleCaseMatchTypeCode(value: string): string {
  return value.toUpperCase()
}

function parsePlayersPage(html: string): ItfDirectoryPlayer[] {
  const players: ItfDirectoryPlayer[] = []
  const pattern =
    /href="(\/en\/players\/([^/"?#]+)\/(\d+)\/([^/"?#]+)\/([^/"?#]+)\/([^/"?#]+)\/overview\/?)"/gi

  let match: RegExpExecArray | null
  while ((match = pattern.exec(html)) !== null) {
    const profileUrl = toNullableString(match[1])
    const slug = toNullableString(match[2])
    const playerId = toNullableString(match[3])
    const circuitCode = toNullableString(match[5])
    const matchTypeCode = toNullableString(match[6])
    if (!slug || !playerId) continue

    const name = slug
      .split('-')
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ')

    players.push({
      playerId,
      name,
      profileUrl,
      meta: {
        circuitCode: circuitCode ? circuitCode.toUpperCase() : null,
        matchTypeCode: matchTypeCode ? titleCaseMatchTypeCode(matchTypeCode) : null,
      },
    })
  }

  return players
}

export class ItfOfficialDirectoryClient implements ItfDirectoryClient {
  private readonly baseUrl: string
  private readonly fetchImpl: typeof fetch

  constructor(options: ItfOfficialDirectoryClientOptions = {}) {
    this.baseUrl = String(options.baseUrl || 'https://www.itftennis.com').replace(/\/+$/, '')
    this.fetchImpl = options.fetchImpl || fetch
  }

  async listPlayers(): Promise<ItfDirectoryPlayer[]> {
    const response = await this.fetchImpl(`${this.baseUrl}/en/players/`, {
      method: 'GET',
      headers: {
        accept: 'text/html,application/xhtml+xml',
      },
    })

    if (!response.ok) {
      throw new Error(`ITF players page request failed: ${response.status} ${response.statusText}`)
    }

    const html = await response.text()
    if (isIncapsulaBlockPage(html)) return []

    return parsePlayersPage(html)
  }

  async findPlayerByExactName(name: string): Promise<ItfDirectoryPlayer | null> {
    const normalized = normalizeName(name)
    if (!normalized) return null

    const players = await this.listPlayers()
    return players.find((player) => normalizeName(player.name) === normalized) ?? null
  }
}

export { isIncapsulaBlockPage, parsePlayersPage as parseItfPlayersPage }
