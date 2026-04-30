import { chromium } from 'playwright-core'
import { normalizeName } from '../realtime-score/tennis/mapper.js'

export interface AtpDirectoryClientOptions {
  baseUrl?: string
  fetchImpl?: typeof fetch
  chromeExecutablePath?: string
}

export interface AtpRankedPlayer {
  rank: number | null
  name: string
  country: string | null
  countryCode: string | null
  playerId: string
  profileUrl: string | null
}

interface AtpRankedPlayerResponse {
  RankNo?: number
  Name?: string
  Country?: string
  CountryCode?: string
  PlayerId?: string
  PlayerProfileUrl?: string
}

interface AtpFindByNameResponse {
  PlayerId?: string
  FirstName?: string
  LastName?: string
  NatlId?: string
}

const CHROME_EXECUTABLE_PATH =
  process.env.FLASHSCORE_CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

function toNullableNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function toNullableString(value: unknown): string | null {
  const text = String(value ?? '').trim()
  return text ? text : null
}

function mapRankedPlayer(input: AtpRankedPlayerResponse): AtpRankedPlayer | null {
  const name = toNullableString(input.Name)
  const playerId = toNullableString(input.PlayerId)
  if (!name || !playerId) return null

  return {
    rank: toNullableNumber(input.RankNo),
    name,
    country: toNullableString(input.Country),
    countryCode: toNullableString(input.CountryCode),
    playerId,
    profileUrl: toNullableString(input.PlayerProfileUrl),
  }
}

function mapFindByNamePlayer(input: AtpFindByNameResponse): AtpRankedPlayer | null {
  const playerId = toNullableString(input.PlayerId)
  const firstName = toNullableString(input.FirstName)
  const lastName = toNullableString(input.LastName)
  if (!playerId || !firstName || !lastName) return null

  return {
    rank: null,
    name: `${firstName} ${lastName}`.trim(),
    country: null,
    countryCode: toNullableString(input.NatlId),
    playerId,
    profileUrl: null,
  }
}

function titleCaseWords(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export function parseAtpPlayerProfileUrl(profileUrl: string, nameFromPage?: string | null): AtpRankedPlayer | null {
  const text = String(profileUrl || '').trim()
  if (!text) return null

  const match = text.match(/\/en\/players\/([^/]+)\/([^/]+)\//i)
  if (!match) return null

  const slug = String(match[1] || '').trim()
  const playerId = toNullableString(match[2])
  if (!playerId) return null

  const pageName = toNullableString(nameFromPage)
  const inferredName =
    pageName ||
    (slug && slug !== '-'
      ? titleCaseWords(
          slug
            .replace(/-/g, ' ')
            .replace(/\s+/g, ' ')
            .trim(),
        )
      : null)

  if (!inferredName) return null

  return {
    rank: null,
    name: inferredName,
    country: null,
    countryCode: null,
    playerId,
    profileUrl: text,
  }
}

export class AtpDirectoryClient {
  private readonly baseUrl: string
  private readonly fetchImpl: typeof fetch
  private readonly chromeExecutablePath: string

  constructor(options: AtpDirectoryClientOptions = {}) {
    this.baseUrl = String(options.baseUrl || 'https://www.atptour.com').replace(/\/+$/, '')
    this.fetchImpl = options.fetchImpl || fetch
    this.chromeExecutablePath = String(options.chromeExecutablePath || CHROME_EXECUTABLE_PATH)
  }

  async listRankedSinglesPlayers(): Promise<AtpRankedPlayer[]> {
    const response = await this.fetchImpl(`${this.baseUrl}/en/-/www/rank/sglroll/`, {
      method: 'GET',
      headers: {
        accept: 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`ATP rankings request failed: ${response.status} ${response.statusText}`)
    }

    const payload = (await response.json()) as AtpRankedPlayerResponse[]
    return Array.isArray(payload) ? payload.map(mapRankedPlayer).filter(Boolean) as AtpRankedPlayer[] : []
  }

  async findPlayersByName(name: string): Promise<AtpRankedPlayer[]> {
    const searchName = String(name || '').trim()
    if (!searchName) return []

    const encoded = encodeURIComponent(searchName)
    const response = await this.fetchImpl(`${this.baseUrl}/en/-/www/players/find/byname/${encoded}/en`, {
      method: 'GET',
      headers: {
        accept: 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`ATP find-by-name request failed: ${response.status} ${response.statusText}`)
    }

    const payload = (await response.json()) as AtpFindByNameResponse[]
    return Array.isArray(payload) ? payload.map(mapFindByNamePlayer).filter(Boolean) as AtpRankedPlayer[] : []
  }

  async findPlayerByExactName(name: string): Promise<AtpRankedPlayer | null> {
    const normalized = normalizeName(name)
    if (!normalized) return null

    const discoveredPlayers = await this.findPlayersByName(name)
    const discoveredMatch = discoveredPlayers.find((player) => normalizeName(player.name) === normalized) ?? null
    if (discoveredMatch) return discoveredMatch

    const players = await this.listRankedSinglesPlayers()
    const rankedMatch = players.find((player) => normalizeName(player.name) === normalized) ?? null
    if (rankedMatch) return rankedMatch

    return await this.findPlayerByExactNameViaPlayersPage(name)
  }

  private async findPlayerByExactNameViaPlayersPage(name: string): Promise<AtpRankedPlayer | null> {
    const normalized = normalizeName(name)
    if (!normalized) return null

    let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null
    let page: Awaited<ReturnType<Awaited<ReturnType<typeof chromium.launch>>['newPage']>> | null = null

    try {
      browser = await chromium.launch({
        executablePath: this.chromeExecutablePath,
        headless: true,
        args: ['--no-sandbox'],
      })
      page = await browser.newPage()
      await page.goto(`${this.baseUrl}/en/players?matchType=Singles&rank=All&region=all`, {
        waitUntil: 'domcontentloaded',
        timeout: 20_000,
      })
      await page.waitForSelector('#search', { timeout: 10_000 })
      await page.fill('#search', name)
      await page.waitForTimeout(1_000)

      const candidate = await page.evaluate((wantedName) => {
        const normalize = (value) =>
          String(value || '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()

        const wanted = normalize(wantedName)
        const anchors = Array.from(
          document.querySelectorAll('.rankings-content a[href*="/en/players/"], .atp_card a.card-link[href*="/en/players/"]'),
        )

        const candidates = anchors
          .map((anchor) => ({
            href: anchor.getAttribute('href') || '',
            name: anchor.textContent || '',
          }))
          .filter((item) => item.href)

        return candidates.find((item) => normalize(item.name) === wanted) || null
      }, name)

      if (!candidate?.href) return null
      const parsed = parseAtpPlayerProfileUrl(candidate.href, candidate.name)
      return parsed && normalizeName(parsed.name) === normalized ? parsed : null
    } catch {
      return null
    } finally {
      if (page) await page.close().catch(() => {})
      if (browser) await browser.close().catch(() => {})
    }
  }
}
