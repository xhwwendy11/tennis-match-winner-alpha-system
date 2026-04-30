import type {
  TennisFeedMatch,
  TennisFeedScorePair,
  TennisFeedSetScore,
  TennisFlashscoreHistoryRow,
  TennisLookupMatch,
  TennisLookupResult,
  TennisTournamentLink,
} from './types.js'

function stripAccents(value: string): string {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
}

export function normalizeName(raw: string): string {
  return stripAccents(raw)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

function normalizeLoose(raw: string): string {
  return normalizeName(raw)
    .replace(/\b[a-z]\b/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

function strippedTokens(raw: string): string[] {
  const parts = normalizeName(raw).split(' ').filter(Boolean)
  while (parts.length > 0 && parts[parts.length - 1]!.length === 1) {
    parts.pop()
  }
  return parts
}

function hasInitials(raw: string): boolean {
  return normalizeName(raw).split(' ').some((part) => part.length === 1)
}

function hasShortGivenNameAbbreviation(raw: string): boolean {
  return /^[A-Za-z-]+\s+[A-Za-z]{2,3}\.$/.test(String(raw || '').trim())
}

function surnameKey(raw: string): string {
  const parts = strippedTokens(raw)
  if (parts.length === 0) return ''
  if (hasShortGivenNameAbbreviation(raw) && parts.length === 2) {
    return parts[0] || ''
  }
  return parts[parts.length - 1] || ''
}

function surnameTokens(raw: string): string[] {
  const parts = strippedTokens(raw)
  if (parts.length === 0) return []
  if (hasShortGivenNameAbbreviation(raw) && parts.length === 2) return [parts[0]!]
  if (hasInitials(raw)) return parts
  if (parts.length >= 3) return parts.slice(-2)
  return [parts[parts.length - 1]!]
}

function nameMatches(actual: string, target: string): boolean {
  const a = normalizeName(actual)
  const b = normalizeName(target)
  if (!a || !b) return false
  if (a === b) return true
  const looseA = normalizeLoose(actual)
  const looseB = normalizeLoose(target)
  return !!looseA && looseA === looseB
}

function surnameMatches(actual: string, target: string): boolean {
  const a = surnameKey(actual)
  const b = surnameKey(target)
  if (!!a && !!b && a === b) return true

  const aTokens = new Set(surnameTokens(actual))
  const bTokens = surnameTokens(target)
  return bTokens.some((token) => token.length >= 3 && aTokens.has(token))
}

export function pairMatches(
  match: TennisFeedMatch,
  teamA: string,
  teamB: string,
): { matched: boolean; matchedBy: TennisLookupResult['matchedBy'] } {
  const leftFull =
    (nameMatches(match.teamA.name, teamA) || nameMatches(match.teamA.shortName, teamA)) &&
    (nameMatches(match.teamB.name, teamB) || nameMatches(match.teamB.shortName, teamB))
  const rightFull =
    (nameMatches(match.teamA.name, teamB) || nameMatches(match.teamA.shortName, teamB)) &&
    (nameMatches(match.teamB.name, teamA) || nameMatches(match.teamB.shortName, teamA))
  if (leftFull || rightFull) return { matched: true, matchedBy: 'full_name' }

  const leftSurname =
    (surnameMatches(match.teamA.name, teamA) || surnameMatches(match.teamA.shortName, teamA)) &&
    (surnameMatches(match.teamB.name, teamB) || surnameMatches(match.teamB.shortName, teamB))
  const rightSurname =
    (surnameMatches(match.teamA.name, teamB) || surnameMatches(match.teamA.shortName, teamB)) &&
    (surnameMatches(match.teamB.name, teamA) || surnameMatches(match.teamB.shortName, teamA))
  if (leftSurname || rightSurname) return { matched: true, matchedBy: 'surname' }

  return { matched: false, matchedBy: 'not_found' }
}

function toDisplayScore(value: number | string | null | undefined): string | null {
  if (value === null || value === undefined || value === '') return null
  return String(value).trim() || null
}

function hasScorePair(score: TennisFeedScorePair | null | undefined): score is TennisFeedScorePair {
  return !!score && (String(score.teamAScore || '').trim() !== '' || String(score.teamBScore || '').trim() !== '')
}

function formatScorePair(
  score: TennisFeedScorePair | null | undefined,
  separator: string,
  opts?: { wrap?: boolean },
): string | null {
  if (!hasScorePair(score)) return null
  const text = `${String(score.teamAScore || '0').trim() || '0'}${separator}${String(score.teamBScore || '0').trim() || '0'}`
  return opts?.wrap ? `(${text})` : text
}

function detailSummaryFor(feedMatch: TennisFeedMatch): string | null {
  const parts: string[] = []
  const matchScore = formatScorePair(
    {
      teamAScore: toDisplayScore(feedMatch.teamA.score) || '',
      teamBScore: toDisplayScore(feedMatch.teamB.score) || '',
    },
    ' - ',
  )
  if (matchScore) parts.push(matchScore)
  if (feedMatch.currentSet?.label) parts.push(feedMatch.currentSet.label)
  const currentSetScore = formatScorePair(feedMatch.currentSet, ' : ')
  if (currentSetScore) parts.push(currentSetScore)
  const currentGameScore = formatScorePair(feedMatch.currentGame, ' : ', { wrap: true })
  if (currentGameScore) parts.push(currentGameScore)
  return parts.length > 0 ? parts.join(' ') : null
}

function normalizedSetRows(feedMatch: TennisFeedMatch): TennisFeedSetScore[] {
  if (feedMatch.sets.length > 0) return feedMatch.sets
  return feedMatch.currentSet ? [feedMatch.currentSet] : []
}

export function toLookupMatch(feedMatch: TennisFeedMatch): TennisLookupMatch {
  const history: TennisFlashscoreHistoryRow[] = []
  const matchScore = formatScorePair(
    {
      teamAScore: toDisplayScore(feedMatch.teamA.score) || '',
      teamBScore: toDisplayScore(feedMatch.teamB.score) || '',
    },
    ' - ',
  )
  if (matchScore) {
    history.push({
      kind: 'summary',
      time: 'Match',
      score: matchScore,
    })
  }
  for (const set of normalizedSetRows(feedMatch)) {
    history.push({
      kind: 'summary',
      time: set.label,
      score: `${set.teamAScore} - ${set.teamBScore}`,
    })
  }
  if (feedMatch.currentGame?.teamAScore || feedMatch.currentGame?.teamBScore) {
    history.push({
      kind: 'event',
      time: 'Current game',
      score: `${feedMatch.currentGame.teamAScore || '0'} - ${feedMatch.currentGame.teamBScore || '0'}`,
      action: 'Points',
    })
  }

  return {
    homeTeam: feedMatch.teamA.name || feedMatch.teamA.shortName,
    awayTeam: feedMatch.teamB.name || feedMatch.teamB.shortName,
    homeScore: feedMatch.teamA.score,
    awayScore: feedMatch.teamB.score,
    startTime: feedMatch.startTimeISO,
    league: feedMatch.tournamentName || null,
    status: feedMatch.status,
    statusText: feedMatch.statusText,
    round: feedMatch.round || null,
    currentSet: feedMatch.currentSet,
    currentGame: feedMatch.currentGame,
    serverSide: feedMatch.serverSide,
    serverSideResolved: feedMatch.serverSideResolved,
    serverSideSource: feedMatch.serverSideSource,
    serveConfidence: feedMatch.serveConfidence,
    serverPlayerName: feedMatch.serverPlayerName,
    sets: normalizedSetRows(feedMatch),
    detailSummary: detailSummaryFor(feedMatch),
    matchUrl: feedMatch.matchUrl,
    sourcePageUrl: feedMatch.sourcePageUrl,
    history,
  }
}

function normalizeTournamentText(raw: string): string {
  const normalized = normalizeName(
    String(raw || '')
      .replace(/,\s*(qualification|qualifying)$/i, '')
      .replace(/\b(atp|wta)\b/gi, ' ')
      .replace(/\b(challenger men singles|challenger women singles)\b/gi, ' ')
      .trim(),
  )

  return normalized
    .replace(/\bcredit one charleston open\b/g, 'charleston')
    .replace(/\bcopa colsanitas\b/g, 'bogota')
    .replace(/\bus men s clay court championships\b/g, 'houston')
    .trim()
    .replace(/\s+/g, ' ')
}

export function scoreTournamentLink(link: TennisTournamentLink, tournamentTitle: string): number {
  let score = link.count * 100
  const wanted = normalizeTournamentText(tournamentTitle)
  const slug = normalizeTournamentText(link.slug.replace(/-/g, ' '))
  const label = normalizeTournamentText(link.label)
  if (wanted) {
    if (wanted === slug || wanted === label) score += 200
    if (wanted && (label.includes(wanted) || wanted.includes(label))) score += 120
    if (wanted && (slug.includes(wanted) || wanted.includes(slug))) score += 90
    const wantedTokens = new Set(wanted.split(' ').filter(Boolean))
    const slugTokens = new Set(slug.split(' ').filter(Boolean))
    const labelTokens = new Set(label.split(' ').filter(Boolean))
    for (const token of wantedTokens) {
      if (slugTokens.has(token)) score += 15
      if (labelTokens.has(token)) score += 20
    }
  }
  return score
}
