import type {
  TennisEventType,
  TennisFeedMatch,
  TennisMatchStatus,
  TennisTournamentLink,
  TennisFeedTeamStats,
} from './types.js'
import { scoreTournamentLink } from './mapper.js'
import { extractServingSideFromRenderedPage } from './serverExtractor.js'

const FLASHSCORE_BASE_URL = 'https://www.flashscore.com'
const FLASHSCORE_TENNIS_ROOT = `${FLASHSCORE_BASE_URL}/tennis/`
const FLASHSCORE_HTTP_CACHE_MS = Number(process.env.FLASHSCORE_TENNIS_CACHE_MS || 1_500)
const FLASHSCORE_HTTP_USER_AGENT =
  process.env.FLASHSCORE_USER_AGENT ||
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'

type CachedText = {
  ts: number
  text: string
}

const pageCache = new Map<string, CachedText>()
const pageInFlight = new Map<string, Promise<string>>()
const feedCache = new Map<string, CachedText>()
const feedInFlight = new Map<string, Promise<string>>()

function cacheMsValue(): number {
  return Number.isFinite(FLASHSCORE_HTTP_CACHE_MS) && FLASHSCORE_HTTP_CACHE_MS > 0 ? Math.floor(FLASHSCORE_HTTP_CACHE_MS) : 20_000
}

function absoluteUrl(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `${FLASHSCORE_BASE_URL}${url}`
}

function categoryPathFor(eventType: TennisEventType): string {
  if (eventType === 'atp') return 'atp-singles'
  if (eventType === 'wta') return 'wta-singles'
  if (eventType === 'atp_challenger') return 'challenger-men-singles'
  return 'challenger-women-singles'
}

function candidateListingUrls(eventType: TennisEventType): string[] {
  const categoryPath = categoryPathFor(eventType)
  const base = `${FLASHSCORE_BASE_URL}/tennis/${categoryPath}/`
  return [base, `${base}fixtures/`, `${base}results/`]
}

function stripHtml(raw: string): string {
  return String(raw || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

async function fetchText(url: string, opts?: { force?: boolean; stats?: { pageFetchCount: number } }): Promise<string> {
  const key = absoluteUrl(url)
  const now = Date.now()
  const ttl = cacheMsValue()
  const cached = pageCache.get(key)
  if (!opts?.force && cached && now - cached.ts < ttl) {
    return cached.text
  }

  if (!pageInFlight.has(key)) {
    pageInFlight.set(
      key,
      (async () => {
        const res = await fetch(key, {
          headers: {
            Accept: 'text/html,application/xhtml+xml',
            'Cache-Control': 'no-cache',
            'User-Agent': FLASHSCORE_HTTP_USER_AGENT,
          },
          redirect: 'follow',
        })
        if (!res.ok) {
          throw new Error(`Flashscore request failed: ${res.status} (${key})`)
        }
        const text = await res.text()
        pageCache.set(key, { ts: Date.now(), text })
        return text
      })().finally(() => {
        pageInFlight.delete(key)
      }),
    )
  }

  opts?.stats && (opts.stats.pageFetchCount += 1)
  return pageInFlight.get(key)!
}

async function fetchFeedText(
  feedName: string,
  params: { feedSign: string; referer: string; force?: boolean; stats?: { pageFetchCount: number } },
): Promise<string> {
  const url = absoluteUrl(`/x/feed/${String(feedName || '').trim()}`)
  const feedSign = String(params.feedSign || '').trim()
  const referer = absoluteUrl(String(params.referer || '').trim() || '/')
  const key = `${url}|${feedSign}|${referer}`
  const now = Date.now()
  const ttl = cacheMsValue()
  const cached = feedCache.get(key)
  if (!params.force && cached && now - cached.ts < ttl) {
    return cached.text
  }

  if (!feedInFlight.has(key)) {
    feedInFlight.set(
      key,
      (async () => {
        const res = await fetch(url, {
          headers: {
            Accept: 'text/plain, */*',
            'Cache-Control': 'no-cache',
            Referer: referer,
            'User-Agent': FLASHSCORE_HTTP_USER_AGENT,
            'x-fsign': feedSign,
          },
          redirect: 'follow',
        })
        if (!res.ok) {
          throw new Error(`Flashscore feed request failed: ${res.status} (${url})`)
        }
        const text = await res.text()
        feedCache.set(key, { ts: Date.now(), text })
        return text
      })().finally(() => {
        feedInFlight.delete(key)
      }),
    )
  }

  params.stats && (params.stats.pageFetchCount += 1)
  return feedInFlight.get(key)!
}

function extractAnchorLinks(html: string, categoryPath: string): TennisTournamentLink[] {
  const escaped = categoryPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(`<a[^>]+href="(/tennis/${escaped}/[^"/?#]+/)"[^>]*>([\\s\\S]*?)</a>`, 'gi')
  const byHref = new Map<string, { slug: string; count: number; labels: Map<string, number> }>()
  let match: RegExpExecArray | null = null
  while ((match = regex.exec(html))) {
    const href = String(match[1] || '').trim()
    const label = stripHtml(match[2] || '')
    const slugMatch = href.match(new RegExp(`/tennis/${escaped}/([^/]+)/`))
    const slug = String(slugMatch?.[1] || '').trim()
    if (!href || !slug) continue
    const entry = byHref.get(href) || { slug, count: 0, labels: new Map<string, number>() }
    entry.count += 1
    if (label) entry.labels.set(label, (entry.labels.get(label) || 0) + 1)
    byHref.set(href, entry)
  }

  return Array.from(byHref.entries()).map(([href, entry]) => {
    const label = Array.from(entry.labels.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || entry.slug
    return {
      url: absoluteUrl(href),
      slug: entry.slug,
      label,
      count: entry.count,
      score: 0,
    }
  })
}

export async function fetchTournamentCandidates(
  eventType: TennisEventType,
  tournamentTitle: string,
  opts?: { force?: boolean; stats?: { pageFetchCount: number } },
): Promise<TennisTournamentLink[]> {
  const categoryPath = categoryPathFor(eventType)
  const merged = new Map<string, TennisTournamentLink>()
  for (const listingUrl of candidateListingUrls(eventType)) {
    const html = await fetchText(listingUrl, opts)
    const links = extractAnchorLinks(html, categoryPath)
    for (const link of links) {
      const prev = merged.get(link.url)
      if (!prev) {
        merged.set(link.url, link)
        continue
      }
      merged.set(link.url, {
        ...prev,
        count: prev.count + link.count,
        label: prev.label.length >= link.label.length ? prev.label : link.label,
      })
    }
  }
  const links = Array.from(merged.values())
  const scored = links
    .map((link) => ({ ...link, score: scoreTournamentLink(link, tournamentTitle) }))
    .sort((a, b) => (b.score - a.score) || (b.count - a.count) || a.slug.localeCompare(b.slug))
  return scored.slice(0, 8)
}

function parseFieldMap(chunk: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const token of String(chunk || '').split('¬')) {
    const idx = token.indexOf('÷')
    if (idx <= 0) continue
    const key = token.slice(0, idx)
    if (!key || out[key] !== undefined) continue
    out[key] = token.slice(idx + 1)
  }
  return out
}

function toIsoFromUnixSeconds(value: string | undefined): string | null {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return null
  return new Date(n * 1000).toISOString()
}

function toNumberOrNull(value: string | undefined): number | null {
  if (value === undefined || value === null || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function hasScoreText(value: string | null | undefined): boolean {
  return String(value || '').trim() !== ''
}

function setOrdinalFromLabel(label: string | null | undefined): number | null {
  const match = String(label || '').match(/\bset\s*(\d+)/i)
  if (!match) return null
  const value = Number(match[1])
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : null
}

function currentSetFromSets(status: TennisMatchStatus, sets: TennisFeedMatch['sets']): TennisFeedMatch['currentSet'] {
  if (status !== 'LIVE' || sets.length === 0) return null
  return sets[sets.length - 1] || null
}

function inferStatus(fields: Record<string, string>, startTimeISO: string | null, teamAScore: number | null, teamBScore: number | null): {
  status: TennisMatchStatus
  statusText: string
} {
  const hasFinalTime = !!String(fields.AO || '').trim()
  const hasSetScores = ['BA', 'BB', 'BC', 'BD', 'BE', 'BF', 'DA', 'DB', 'DC', 'DD'].some((key) => {
    const value = String(fields[key] || '').trim()
    return value !== ''
  })
  const hasGamePoints = String(fields.WA || '').trim() !== '' || String(fields.WB || '').trim() !== ''
  if (hasFinalTime) return { status: 'FINAL', statusText: 'Finished' }
  if (hasSetScores || hasGamePoints || (Number(teamAScore) || 0) > 0 || (Number(teamBScore) || 0) > 0) {
    return { status: 'LIVE', statusText: 'Live' }
  }
  if (startTimeISO) return { status: 'PRE', statusText: 'Scheduled' }
  return { status: 'UNKNOWN', statusText: 'Unknown' }
}

function buildMatchUrl(fields: Record<string, string>): string | null {
  const aSlug = String(fields.WU || '').trim()
  const aId = String(fields.PX || '').trim()
  const bSlug = String(fields.WV || '').trim()
  const bId = String(fields.PY || '').trim()
  if (!aSlug || !aId || !bSlug || !bId) return null
  return `${FLASHSCORE_BASE_URL}/match/tennis/${bSlug}-${bId}/${aSlug}-${aId}/`
}

function buildSetScores(fields: Record<string, string>): TennisFeedMatch['sets'] {
  const pairs: Array<[string, string, string]> = [
    ['Set 1', 'BA', 'BB'],
    ['Set 2', 'BC', 'BD'],
    ['Set 3', 'BE', 'BF'],
    ['Set 4', 'DA', 'DB'],
    ['Set 5', 'DC', 'DD'],
  ]
  const out: TennisFeedMatch['sets'] = []
  for (const [label, aKey, bKey] of pairs) {
    const aScore = String(fields[aKey] || '').trim()
    const bScore = String(fields[bKey] || '').trim()
    if (!aScore && !bScore) continue
    out.push({
      label,
      teamAScore: aScore || '0',
      teamBScore: bScore || '0',
    })
  }
  return out
}

function mergeSetScores(
  baseSets: TennisFeedMatch['sets'],
  detailSets: TennisFeedMatch['sets'],
  detailCurrentSet: TennisFeedMatch['currentSet'],
): TennisFeedMatch['sets'] {
  const merged: TennisFeedMatch['sets'] = []
  const upsert = (set: TennisFeedMatch['currentSet']) => {
    if (!set) return
    const label = String(set.label || '').trim()
    if (!label) return
    const ordinal = setOrdinalFromLabel(label)
    const idx = merged.findIndex((item) => {
      const existingLabel = String(item.label || '').trim()
      if (!existingLabel) return false
      if (existingLabel === label) return true
      const existingOrdinal = setOrdinalFromLabel(existingLabel)
      return ordinal != null && existingOrdinal != null && ordinal === existingOrdinal
    })
    const normalized = {
      label,
      teamAScore: String(set.teamAScore || '').trim() || '0',
      teamBScore: String(set.teamBScore || '').trim() || '0',
    }
    if (idx >= 0) {
      const existing = merged[idx]!
      merged[idx] = {
        label: String(existing.label || '').trim() || normalized.label,
        teamAScore: normalized.teamAScore,
        teamBScore: normalized.teamBScore,
      }
    } else {
      merged.push(normalized)
    }
  }

  for (const set of baseSets) upsert(set)
  for (const set of detailSets) upsert(set)
  upsert(detailCurrentSet)
  return merged
}

function flattenCommonFeed(entries: unknown): Record<string, string> {
  const out: Record<string, string> = {}
  if (!Array.isArray(entries)) return out
  for (const entry of entries) {
    if (!entry || typeof entry !== 'object') continue
    for (const [key, value] of Object.entries(entry as Record<string, unknown>)) {
      if (!key || out[key] !== undefined || value === undefined || value === null) continue
      out[key] = String(value)
    }
  }
  return out
}

function extractWindowEnvironment(html: string): Record<string, any> | null {
  const anchor = 'window.environment = '
  const start = html.indexOf(anchor)
  if (start < 0) return null
  const jsonStart = html.indexOf('{', start)
  if (jsonStart < 0) return null

  let depth = 0
  let inString = false
  let escaped = false
  let jsonEnd = -1
  for (let i = jsonStart; i < html.length; i += 1) {
    const ch = html[i]
    if (inString) {
      if (escaped) {
        escaped = false
        continue
      }
      if (ch === '\\') {
        escaped = true
        continue
      }
      if (ch === '"') {
        inString = false
      }
      continue
    }
    if (ch === '"') {
      inString = true
      continue
    }
    if (ch === '{') {
      depth += 1
      continue
    }
    if (ch === '}') {
      depth -= 1
      if (depth === 0) {
        jsonEnd = i + 1
        break
      }
    }
  }
  if (jsonEnd < 0) return null
  try {
    return JSON.parse(html.slice(jsonStart, jsonEnd))
  } catch {
    return null
  }
}

function collectFeedFields(payload: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const chunk of String(payload || '').split('¬~')) {
    const fields = parseFieldMap(chunk)
    for (const [key, value] of Object.entries(fields)) {
      if (!key || out[key] !== undefined) continue
      out[key] = value
    }
  }
  return out
}

function parseVerticalSummarySets(payload: string): TennisFeedMatch['sets'] {
  const out: TennisFeedMatch['sets'] = []
  for (const chunk of String(payload || '').split('¬~')) {
    const fields = parseFieldMap(chunk)
    const label = stripHtml(String(fields.AC || '').trim())
    const teamAScore = String(fields.IG || '').trim()
    const teamBScore = String(fields.IH || '').trim()
    if (!label || (!teamAScore && !teamBScore)) continue
    out.push({
      label,
      teamAScore: teamAScore || '0',
      teamBScore: teamBScore || '0',
    })
  }
  return out
}

function parseDetailSummarySets(payload: string): TennisFeedMatch['sets'] {
  const vertical = parseVerticalSummarySets(payload)
  if (vertical.length > 0) return vertical
  return buildSetScores(collectFeedFields(payload))
}

function normalizeStatLabel(raw: string): string {
  return stripHtml(raw)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

function parseStatRows(payload: string): Array<{ label: string; teamAValue: string | null; teamBValue: string | null }> {
  const rows: Array<{ label: string; teamAValue: string | null; teamBValue: string | null }> = []
  for (const chunk of String(payload || '').split('~')) {
    const fields = parseFieldMap(chunk)
    const label = stripHtml(fields.SG || '')
    if (!label) continue
    rows.push({
      label,
      teamAValue: String(fields.SH || '').trim() || null,
      teamBValue: String(fields.SI || '').trim() || null,
    })
  }
  return rows
}

function toLeadingInteger(value: string | null | undefined): number | null {
  const match = String(value || '').match(/-?\d+/)
  if (!match) return null
  const parsed = Number(match[0])
  return Number.isFinite(parsed) ? parsed : null
}

function findStat(rows: Array<{ label: string; teamAValue: string | null; teamBValue: string | null }>, wanted: string) {
  const normalizedWanted = normalizeStatLabel(wanted)
  return rows.find((row) => normalizeStatLabel(row.label) === normalizedWanted) || null
}

function numeratorFromRatio(value: string | null | undefined): number | null {
  const match = String(value || '').match(/\((\d+)\/(\d+)\)/) || String(value || '').match(/^(\d+)\/(\d+)/)
  if (!match) return null
  const parsed = Number(match[1])
  return Number.isFinite(parsed) ? parsed : null
}

function ratioParts(value: string | null | undefined): { num: number; den: number } | null {
  const match = String(value || '').match(/\((\d+)\/(\d+)\)/) || String(value || '').match(/^(\d+)\/(\d+)/)
  if (!match) return null
  const num = Number(match[1])
  const den = Number(match[2])
  if (!Number.isFinite(num) || !Number.isFinite(den) || den <= 0) return null
  return { num, den }
}

function combineRatios(a: string | null | undefined, b: string | null | undefined): string | null {
  const first = ratioParts(a)
  const second = ratioParts(b)
  if (!first && !second) return null
  const num = (first?.num || 0) + (second?.num || 0)
  const den = (first?.den || 0) + (second?.den || 0)
  if (den <= 0) return null
  const pct = Math.round((num / den) * 100)
  return `${pct}% (${num}/${den})`
}

export function parseTennisStats(payload: string): TennisFeedTeamStats | null {
  const rows = parseStatRows(payload)
  if (rows.length === 0) return null

  const aces = findStat(rows, 'Aces')
  const doubleFaults = findStat(rows, 'Double Faults')
  const firstServePercentage = findStat(rows, '1st serve percentage')
  const firstServeWon = findStat(rows, '1st serve points won')
  const secondServeWon = findStat(rows, '2nd serve points won')
  const firstServeReturnPointsWon = findStat(rows, '1st return points won')
  const secondServeReturnPointsWon = findStat(rows, '2nd return points won')
  const breakPointsSaved = findStat(rows, 'Break Points Saved')
  const breakPointsConverted = findStat(rows, 'Break Points Converted')
  const serviceGamesWon = findStat(rows, 'Service games won')
  const returnGamesWon = findStat(rows, 'Return games won')
  const totalPointsWon = findStat(rows, 'Total Points Won')

  const serviceGamesWonA = numeratorFromRatio(serviceGamesWon?.teamAValue)
  const serviceGamesWonB = numeratorFromRatio(serviceGamesWon?.teamBValue)
  return {
    acesA: toLeadingInteger(aces?.teamAValue),
    acesB: toLeadingInteger(aces?.teamBValue),
    doubleFaultsA: toLeadingInteger(doubleFaults?.teamAValue),
    doubleFaultsB: toLeadingInteger(doubleFaults?.teamBValue),
    firstServePercentageA: firstServePercentage?.teamAValue || null,
    firstServePercentageB: firstServePercentage?.teamBValue || null,
    firstServeWonA: firstServeWon?.teamAValue || null,
    firstServeWonB: firstServeWon?.teamBValue || null,
    secondServeWonA: secondServeWon?.teamAValue || null,
    secondServeWonB: secondServeWon?.teamBValue || null,
    servicePointsWonA: combineRatios(firstServeWon?.teamAValue, secondServeWon?.teamAValue),
    servicePointsWonB: combineRatios(firstServeWon?.teamBValue, secondServeWon?.teamBValue),
    firstServeReturnPointsWonA: firstServeReturnPointsWon?.teamAValue || null,
    firstServeReturnPointsWonB: firstServeReturnPointsWon?.teamBValue || null,
    secondServeReturnPointsWonA: secondServeReturnPointsWon?.teamAValue || null,
    secondServeReturnPointsWonB: secondServeReturnPointsWon?.teamBValue || null,
    returnPointsWonA: combineRatios(firstServeReturnPointsWon?.teamAValue, secondServeReturnPointsWon?.teamAValue),
    returnPointsWonB: combineRatios(firstServeReturnPointsWon?.teamBValue, secondServeReturnPointsWon?.teamBValue),
    breakPointsSavedA: breakPointsSaved?.teamAValue || null,
    breakPointsSavedB: breakPointsSaved?.teamBValue || null,
    breakPointsConvertedA: breakPointsConverted?.teamAValue || null,
    breakPointsConvertedB: breakPointsConverted?.teamBValue || null,
    serviceGamesPlayedA: serviceGamesWon?.teamAValue || null,
    serviceGamesPlayedB: serviceGamesWon?.teamBValue || null,
    returnGamesPlayedA: returnGamesWon?.teamAValue || null,
    returnGamesPlayedB: returnGamesWon?.teamBValue || null,
    returnGamesWonA: returnGamesWon?.teamAValue || null,
    returnGamesWonB: returnGamesWon?.teamBValue || null,
    pointsWonA: numeratorFromRatio(totalPointsWon?.teamAValue),
    pointsWonB: numeratorFromRatio(totalPointsWon?.teamBValue),
    serviceGamesWonA,
    serviceGamesWonB,
    breakPointsDisplayA: breakPointsConverted?.teamAValue || null,
    breakPointsDisplayB: breakPointsConverted?.teamBValue || null,
  }
}

function buildDetailFeedContext(html: string, sourcePageUrl: string): {
  eventId: string
  projectId: string
  feedSign: string
  referer: string
} | null {
  const env = extractWindowEnvironment(html)
  if (!env) return null
  const eventId = String(env.event_id_c || '').trim()
  const projectId = String(env.project_id || env?.config?.app?.project?.id || env?.config?.project?.id || '').trim()
  const feedSign = String(env?.config?.app?.feed_sign || env?.config?.feed_sign || '').trim()
  if (!eventId || !projectId || !feedSign) return null
  const referer = env.basenameUrl
    ? absoluteUrl(`${String(env.basenameUrl).replace(/\/+$/, '')}/`)
    : absoluteUrl(sourcePageUrl)
  return {
    eventId,
    projectId,
    feedSign,
    referer,
  }
}

async function enrichDetailPageMatch(
  match: TennisFeedMatch,
  context: { eventId: string; projectId: string; feedSign: string; referer: string },
  opts?: { force?: boolean; stats?: { pageFetchCount: number } },
): Promise<TennisFeedMatch> {
  try {
    const [summaryPayload, statsPayload] = await Promise.all([
      fetchFeedText(`df_sui_${context.projectId}_${context.eventId}`, {
        feedSign: context.feedSign,
        referer: context.referer,
        force: !!opts?.force,
        stats: opts?.stats,
      }),
      fetchFeedText(`df_st_${context.projectId}_${context.eventId}`, {
        feedSign: context.feedSign,
        referer: context.referer,
        force: !!opts?.force,
        stats: opts?.stats,
      }).catch(() => ''),
    ])
    const detailSets = parseDetailSummarySets(summaryPayload)
    const stats = parseTennisStats(statsPayload)
    if (detailSets.length === 0 && !stats) return match
    const sets = mergeSetScores(match.sets, detailSets, match.currentSet)
    return {
      ...match,
      stats: stats || match.stats,
      sets,
      currentSet: match.currentSet || currentSetFromSets(match.status, sets),
    }
  } catch {
    return match
  }
}

function inferDetailStatus(
  stageTypeId: number | null,
  translations: Record<string, string>,
  startTimeISO: string | null,
): { status: TennisMatchStatus; statusText: string } {
  const statusText = stripHtml(String((stageTypeId != null && translations[String(stageTypeId)]) || '').trim()) || 'Unknown'
  if (stageTypeId === 2) return { status: 'LIVE', statusText: statusText || 'Live' }
  if ([3, 8, 9, 54].includes(Number(stageTypeId))) return { status: 'FINAL', statusText: statusText || 'Finished' }
  if (startTimeISO) return { status: 'PRE', statusText: statusText === 'Unknown' ? 'Scheduled' : statusText }
  return { status: 'UNKNOWN', statusText }
}

function buildDetailPageMatch(html: string, sourcePageUrl: string): TennisFeedMatch | null {
  const env = extractWindowEnvironment(html)
  if (!env) return null

  const header = (env.header || {}) as Record<string, any>
  const tournament = (header.tournament || {}) as Record<string, any>
  const participants = (env.participantsData || {}) as Record<string, any>
  const home = Array.isArray(participants.home) ? participants.home[0] || null : null
  const away = Array.isArray(participants.away) ? participants.away[0] || null : null
  const eventId = String(env.event_id_c || '').trim()
  if (!eventId || !home || !away) return null

  const common = flattenCommonFeed(env.common_feed)
  const tournamentText = String(tournament.tournament || '').trim()
  const [rawTournamentName, rawRound] = tournamentText.split(/\s+-\s+/, 2)
  const tournamentName = String(rawTournamentName || tournamentText || '').split(',')[0]?.trim() || ''
  const round = String(rawRound || env.final_stage || '').trim()
  const startTimeISO = toIsoFromUnixSeconds(common.DC || common.AD || common.ADE || env.eventStageStartTime)
  const translations = (env.eventStageTranslations || {}) as Record<string, string>
  const inferred = inferDetailStatus(toNumberOrNull(env.eventStageTypeId)?.valueOf() ?? null, translations, startTimeISO)
  const stageLabel = stripHtml(String(translations[String(env.eventStageId)] || '').trim()) || 'Current set'
  const currentSetA = String(common.DN || '').trim()
  const currentSetB = String(common.DO || '').trim()
  const currentPointA = String(common.DQ || '').trim()
  const currentPointB = String(common.DP || '').trim()
  const teamAScore = toNumberOrNull(common.DE) ?? toNumberOrNull(common.DG)
  const teamBScore = toNumberOrNull(common.DF) ?? toNumberOrNull(common.DH)
  const isLive = inferred.status === 'LIVE'
  const currentSet =
    isLive && (currentSetA || currentSetB)
      ? {
          label: stageLabel,
          teamAScore: currentSetA || '0',
          teamBScore: currentSetB || '0',
        }
      : null

  return {
    eventId,
    tournamentName: tournamentName || tournamentText || 'Tennis',
    tournamentPath: tournament.link ? absoluteUrl(String(tournament.link)) : null,
    tournamentLabel: String(tournament.category || '').trim(),
    round,
    startTimeISO,
    status: inferred.status,
    statusText: inferred.statusText,
    teamA: {
      name: String(home.seo_name || home.name || home.short_name || '').trim(),
      shortName: String(home.short_name || home.name || home.seo_name || '').trim(),
      code: String(home.three_char_name || '').trim(),
      slug: String(home.url_name || '').trim(),
      playerId: String(home.id || '').trim(),
      score: teamAScore,
    },
    teamB: {
      name: String(away.seo_name || away.name || away.short_name || '').trim(),
      shortName: String(away.short_name || away.name || away.seo_name || '').trim(),
      code: String(away.three_char_name || '').trim(),
      slug: String(away.url_name || '').trim(),
      playerId: String(away.id || '').trim(),
      score: teamBScore,
    },
    currentSet,
    currentGame:
      isLive && (currentPointA || currentPointB)
        ? {
            teamAScore: currentPointA || '0',
            teamBScore: currentPointB || '0',
          }
        : null,
    serverSide: null,
    serverSideResolved: null,
    serverSideSource: 'unknown',
    serveConfidence: 'low',
    serverPlayerName: null,
    stats: null,
    sets: currentSet ? [currentSet] : [],
    matchUrl: env.basenameUrl ? absoluteUrl(`${String(env.basenameUrl).replace(/\/+$/, '')}/`) : absoluteUrl(sourcePageUrl),
    sourcePageUrl,
  }
}

function parseFeedPayload(payload: string, sourcePageUrl: string): TennisFeedMatch[] {
  const chunks = String(payload || '').split('¬~')
  const matches: TennisFeedMatch[] = []
  let tournamentName = ''
  let tournamentPath: string | null = null
  let tournamentLabel = ''

  for (const chunk of chunks) {
    const fields = parseFieldMap(chunk)
    if (fields.ZA || fields.ZL || fields.ZAF) {
      tournamentName = String(fields.ZA || tournamentName || '').trim()
      tournamentPath = String(fields.ZL || '').trim() || tournamentPath
      tournamentLabel = String(fields.ZAF || tournamentLabel || '').trim()
      continue
    }
    if (!fields.AA) continue

    const teamAScore = toNumberOrNull(fields.AG) ?? toNumberOrNull(fields.AT)
    const teamBScore = toNumberOrNull(fields.AH) ?? toNumberOrNull(fields.AU)
    const startTimeISO = toIsoFromUnixSeconds(fields.AD || fields.ADE)
    const inferred = inferStatus(fields, startTimeISO, teamAScore, teamBScore)
    const currentGameA = String(fields.WA || '').trim()
    const currentGameB = String(fields.WB || '').trim()
    const sets = buildSetScores(fields)
    const currentSet = currentSetFromSets(inferred.status, sets)

    matches.push({
      eventId: String(fields.AA || '').trim(),
      tournamentName,
      tournamentPath: tournamentPath ? absoluteUrl(tournamentPath) : null,
      tournamentLabel,
      round: String(fields.ER || '').trim(),
      startTimeISO,
      status: inferred.status,
      statusText: inferred.statusText,
      teamA: {
        name: String(fields.AE || fields.CX || '').trim(),
        shortName: String(fields.CX || fields.AE || '').trim(),
        code: String(fields.WM || '').trim(),
        slug: String(fields.WU || '').trim(),
        playerId: String(fields.PX || '').trim(),
        score: teamAScore,
      },
      teamB: {
        name: String(fields.AF || fields.CY || '').trim(),
        shortName: String(fields.AF || '').trim(),
        code: String(fields.WN || '').trim(),
        slug: String(fields.WV || '').trim(),
        playerId: String(fields.PY || '').trim(),
        score: teamBScore,
      },
      currentSet,
      currentGame:
        currentGameA || currentGameB
          ? {
              teamAScore: currentGameA || '0',
              teamBScore: currentGameB || '0',
            }
          : null,
      serverSide: null,
      serverSideResolved: null,
      serverSideSource: 'unknown',
      serveConfidence: 'low',
      serverPlayerName: null,
      stats: null,
      sets,
      matchUrl: buildMatchUrl(fields),
      sourcePageUrl,
    })
  }

  return matches
}

function extractFeedPayloads(html: string): string[] {
  const out: string[] = []
  const regex = /data:\s*`([\s\S]*?)`/g
  let match: RegExpExecArray | null = null
  while ((match = regex.exec(html))) {
    const payload = String(match[1] || '')
    if (payload) out.push(payload)
  }
  return out
}

export async function fetchTournamentMatches(
  tournamentUrl: string,
  opts?: { force?: boolean; stats?: { pageFetchCount: number } },
): Promise<TennisFeedMatch[]> {
  const baseUrl = tournamentUrl.replace(/\/+$/, '')
  const urls = [
    tournamentUrl,
    `${baseUrl}/fixtures/`,
    `${baseUrl}/results/`,
    `${baseUrl}/draw/`,
  ]
  const deduped = Array.from(new Set(urls.map((url) => absoluteUrl(url.endsWith('/') ? url : `${url}/`))))
  const matches = new Map<string, TennisFeedMatch>()
  for (const url of deduped) {
    let html = ''
    try {
      html = await fetchText(url, opts)
    } catch (error: any) {
      const message = String(error?.message || error || '')
      const isBasePage = url === absoluteUrl(tournamentUrl.endsWith('/') ? tournamentUrl : `${tournamentUrl}/`)
      if (!isBasePage && message.includes('404')) continue
      throw error
    }
    const payloads = extractFeedPayloads(html)
    for (const payload of payloads) {
      for (const match of parseFeedPayload(payload, url)) {
        const key = String(match.eventId || '').trim()
        if (!key) continue
        const existing = matches.get(key)
        if (!existing) {
          matches.set(key, match)
          continue
        }

        // Prefer pages that carry richer live/final data over draw placeholders.
        if (existing.status === 'PRE' && match.status !== 'PRE') {
          matches.set(key, match)
          continue
        }
        if (!existing.matchUrl && match.matchUrl) {
          matches.set(key, match)
          continue
        }
      }
    }
  }
  return Array.from(matches.values())
}

function mergeFeedMatch(existing: TennisFeedMatch, detailMatch: TennisFeedMatch): TennisFeedMatch {
  const status = existing.status === 'PRE' && detailMatch.status !== 'PRE' ? detailMatch.status : existing.status
  const statusText =
    existing.status === 'PRE' && detailMatch.status !== 'PRE'
      ? detailMatch.statusText
      : (detailMatch.statusText || existing.statusText)
  const sets = mergeSetScores(existing.sets, detailMatch.sets, detailMatch.currentSet)

  return {
    ...existing,
    tournamentName: existing.tournamentName || detailMatch.tournamentName,
    tournamentPath: existing.tournamentPath || detailMatch.tournamentPath,
    tournamentLabel: existing.tournamentLabel || detailMatch.tournamentLabel,
    round: existing.round || detailMatch.round,
    startTimeISO: existing.startTimeISO || detailMatch.startTimeISO,
    status,
    statusText,
    teamA: {
      ...existing.teamA,
      name: detailMatch.teamA.name || existing.teamA.name,
      shortName: detailMatch.teamA.shortName || existing.teamA.shortName,
      code: detailMatch.teamA.code || existing.teamA.code,
      slug: detailMatch.teamA.slug || existing.teamA.slug,
      playerId: detailMatch.teamA.playerId || existing.teamA.playerId,
      score: detailMatch.teamA.score ?? existing.teamA.score,
    },
    teamB: {
      ...existing.teamB,
      name: detailMatch.teamB.name || existing.teamB.name,
      shortName: detailMatch.teamB.shortName || existing.teamB.shortName,
      code: detailMatch.teamB.code || existing.teamB.code,
      slug: detailMatch.teamB.slug || existing.teamB.slug,
      playerId: detailMatch.teamB.playerId || existing.teamB.playerId,
      score: detailMatch.teamB.score ?? existing.teamB.score,
    },
    currentSet: detailMatch.currentSet || currentSetFromSets(status, sets),
    currentGame:
      hasScoreText(detailMatch.currentGame?.teamAScore) || hasScoreText(detailMatch.currentGame?.teamBScore)
        ? detailMatch.currentGame
        : existing.currentGame,
    serverSide: detailMatch.serverSide ?? existing.serverSide,
    serverSideResolved: detailMatch.serverSideResolved ?? existing.serverSideResolved,
    serverSideSource: detailMatch.serverSideResolved ? detailMatch.serverSideSource : existing.serverSideSource,
    serveConfidence: detailMatch.serverSideResolved ? detailMatch.serveConfidence : existing.serveConfidence,
    serverPlayerName: detailMatch.serverPlayerName ?? existing.serverPlayerName,
    stats: detailMatch.stats ?? existing.stats,
    sets,
    matchUrl: detailMatch.matchUrl || existing.matchUrl,
    sourcePageUrl: detailMatch.sourcePageUrl || existing.sourcePageUrl,
  }
}

export async function fetchDirectMatchPage(
  matchUrl: string,
  opts?: { force?: boolean; stats?: { pageFetchCount: number }; includeRenderedServe?: boolean },
): Promise<TennisFeedMatch[]> {
  const url = absoluteUrl(matchUrl)
  const html = await fetchText(url, opts)
  const servingInfoPromise =
    opts?.includeRenderedServe === false
      ? Promise.resolve({
          serverSide: null,
          serverSideResolved: null,
          serverSideSource: 'unknown' as const,
          serveConfidence: 'low' as const,
          serverPlayerName: null,
          stats: null,
        })
      : extractServingSideFromRenderedPage(url)
  const payloads = extractFeedPayloads(html)
  const matches = new Map<string, TennisFeedMatch>()
  for (const payload of payloads) {
    for (const match of parseFeedPayload(payload, url)) {
      const key = String(match.eventId || '').trim()
      if (!key) continue
      matches.set(key, match)
    }
  }
  const detailMatch = buildDetailPageMatch(html, url)
  if (detailMatch) {
    const feedContext = buildDetailFeedContext(html, url)
    const enrichedDetailMatch = feedContext
      ? await enrichDetailPageMatch(detailMatch, feedContext, opts)
      : detailMatch
    const existing = matches.get(enrichedDetailMatch.eventId)
    matches.set(enrichedDetailMatch.eventId, existing ? mergeFeedMatch(existing, enrichedDetailMatch) : enrichedDetailMatch)
  }
  const list = Array.from(matches.values())
  const servingInfo = await servingInfoPromise.catch(() => ({
    serverSide: null,
    serverSideResolved: null,
    serverSideSource: 'unknown' as const,
    serveConfidence: 'low' as const,
    serverPlayerName: null,
    stats: null,
  }))
  return list.map((match) => ({
    ...match,
    serverSide: servingInfo.serverSide,
    serverSideResolved: servingInfo.serverSideResolved,
    serverSideSource: servingInfo.serverSideSource,
    serveConfidence: servingInfo.serveConfidence,
    serverPlayerName: servingInfo.serverPlayerName,
  }))
}

export async function fetchPlayerResultsMatches(
  player: { slug: string; playerId: string },
  opts?: { force?: boolean; stats?: { pageFetchCount: number } },
): Promise<TennisFeedMatch[]> {
  const slug = String(player.slug || '').trim()
  const playerId = String(player.playerId || '').trim()
  if (!slug || !playerId) return []

  const url = absoluteUrl(`/player/${slug}/${playerId}/results/`)
  const html = await fetchText(url, opts)
  const matches = new Map<string, TennisFeedMatch>()
  for (const payload of extractFeedPayloads(html)) {
    for (const match of parseFeedPayload(payload, url)) {
      const key = String(match.eventId || '').trim()
      if (!key) continue
      matches.set(key, match)
    }
  }
  return Array.from(matches.values())
}

export function tennisSourceUrl(): string {
  return FLASHSCORE_TENNIS_ROOT
}

export function tennisLookupCacheMs(): number {
  return cacheMsValue()
}
