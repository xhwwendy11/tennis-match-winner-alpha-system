import type {
  TennisFeedMatch,
  TennisFeedScorePair,
  TennisFeedSetScore,
  TennisFeedTeamStats,
  TennisMatchStatus,
} from '../realtime-score/tennis/types.js'

export type ServerTennisSide = 'teamA' | 'teamB' | null

export interface ServerTennisParticipant {
  name: string
  shortName?: string | null
  code?: string | null
  slug?: string | null
  playerId?: string | null
  score?: number | null
}

export interface ServerTennisSetScorePayload {
  label?: string | null
  teamAScore: string | number | null
  teamBScore: string | number | null
}

export interface ServerTennisPointPayload {
  teamAScore: string | number | null
  teamBScore: string | number | null
}

export interface ServerTennisMatchPayload {
  matchId?: string | null
  matchUrl?: string | null
  sourcePageUrl?: string | null
  tournamentName?: string | null
  tournamentPath?: string | null
  tournamentLabel?: string | null
  round?: string | null
  startTimeISO?: string | null
  status: TennisMatchStatus
  statusText?: string | null
  teamA: ServerTennisParticipant
  teamB: ServerTennisParticipant
  currentSet?: ServerTennisSetScorePayload | null
  currentGame?: ServerTennisPointPayload | null
  sets?: ServerTennisSetScorePayload[] | null
  serverSide?: ServerTennisSide
  serverSideResolved?: ServerTennisSide
  serverSideSource?: 'dom' | 'retry' | 'unknown' | null
  serveConfidence?: 'high' | 'low' | null
  serverPlayerName?: string | null
  stats?: Partial<TennisFeedTeamStats> | null
}

export interface ServerTennisMatchEnvelope {
  match: ServerTennisMatchPayload
}

function normalizeText(value: string | number | null | undefined): string {
  return String(value ?? '').trim()
}

function normalizeNullableText(value: string | number | null | undefined): string | null {
  const normalized = normalizeText(value)
  return normalized || null
}

function normalizeSetScore(payload: ServerTennisSetScorePayload | null | undefined): TennisFeedSetScore | null {
  if (!payload) return null
  return {
    label: normalizeText(payload.label ?? ''),
    teamAScore: normalizeText(payload.teamAScore),
    teamBScore: normalizeText(payload.teamBScore),
  }
}

function normalizePointScore(payload: ServerTennisPointPayload | null | undefined): TennisFeedScorePair | null {
  if (!payload) return null
  return {
    teamAScore: normalizeText(payload.teamAScore),
    teamBScore: normalizeText(payload.teamBScore),
  }
}

function normalizeStats(stats: Partial<TennisFeedTeamStats> | null | undefined): TennisFeedTeamStats | null {
  if (!stats) return null
  return {
    acesA: stats.acesA ?? null,
    acesB: stats.acesB ?? null,
    doubleFaultsA: stats.doubleFaultsA ?? null,
    doubleFaultsB: stats.doubleFaultsB ?? null,
    firstServePercentageA: stats.firstServePercentageA ?? null,
    firstServePercentageB: stats.firstServePercentageB ?? null,
    firstServeWonA: stats.firstServeWonA ?? null,
    firstServeWonB: stats.firstServeWonB ?? null,
    secondServeWonA: stats.secondServeWonA ?? null,
    secondServeWonB: stats.secondServeWonB ?? null,
    servicePointsWonA: stats.servicePointsWonA ?? null,
    servicePointsWonB: stats.servicePointsWonB ?? null,
    firstServeReturnPointsWonA: stats.firstServeReturnPointsWonA ?? null,
    firstServeReturnPointsWonB: stats.firstServeReturnPointsWonB ?? null,
    secondServeReturnPointsWonA: stats.secondServeReturnPointsWonA ?? null,
    secondServeReturnPointsWonB: stats.secondServeReturnPointsWonB ?? null,
    returnPointsWonA: stats.returnPointsWonA ?? null,
    returnPointsWonB: stats.returnPointsWonB ?? null,
    breakPointsSavedA: stats.breakPointsSavedA ?? null,
    breakPointsSavedB: stats.breakPointsSavedB ?? null,
    breakPointsConvertedA: stats.breakPointsConvertedA ?? null,
    breakPointsConvertedB: stats.breakPointsConvertedB ?? null,
    serviceGamesPlayedA: stats.serviceGamesPlayedA ?? null,
    serviceGamesPlayedB: stats.serviceGamesPlayedB ?? null,
    returnGamesPlayedA: stats.returnGamesPlayedA ?? null,
    returnGamesPlayedB: stats.returnGamesPlayedB ?? null,
    returnGamesWonA: stats.returnGamesWonA ?? null,
    returnGamesWonB: stats.returnGamesWonB ?? null,
    pointsWonA: stats.pointsWonA ?? null,
    pointsWonB: stats.pointsWonB ?? null,
    serviceGamesWonA: stats.serviceGamesWonA ?? null,
    serviceGamesWonB: stats.serviceGamesWonB ?? null,
    breakPointsDisplayA: stats.breakPointsDisplayA ?? null,
    breakPointsDisplayB: stats.breakPointsDisplayB ?? null,
  }
}

export function unwrapServerTennisMatchPayload(
  payload: ServerTennisMatchPayload | ServerTennisMatchEnvelope,
): ServerTennisMatchPayload {
  if ('match' in payload && payload.match) return payload.match
  return payload
}

export function mapServerPayloadToTennisFeedMatch(
  rawPayload: ServerTennisMatchPayload | ServerTennisMatchEnvelope,
): TennisFeedMatch {
  const payload = unwrapServerTennisMatchPayload(rawPayload)

  return {
    eventId: normalizeText(payload.matchId ?? ''),
    tournamentName: normalizeText(payload.tournamentName ?? ''),
    tournamentPath: normalizeNullableText(payload.tournamentPath),
    tournamentLabel: normalizeText(payload.tournamentLabel ?? ''),
    round: normalizeText(payload.round ?? ''),
    startTimeISO: normalizeNullableText(payload.startTimeISO),
    status: payload.status,
    statusText: normalizeText(payload.statusText ?? payload.status),
    teamA: {
      name: normalizeText(payload.teamA.name),
      shortName: normalizeText(payload.teamA.shortName ?? payload.teamA.name),
      code: normalizeText(payload.teamA.code ?? ''),
      slug: normalizeText(payload.teamA.slug ?? ''),
      playerId: normalizeText(payload.teamA.playerId ?? ''),
      score: payload.teamA.score ?? null,
    },
    teamB: {
      name: normalizeText(payload.teamB.name),
      shortName: normalizeText(payload.teamB.shortName ?? payload.teamB.name),
      code: normalizeText(payload.teamB.code ?? ''),
      slug: normalizeText(payload.teamB.slug ?? ''),
      playerId: normalizeText(payload.teamB.playerId ?? ''),
      score: payload.teamB.score ?? null,
    },
    currentSet: normalizeSetScore(payload.currentSet),
    currentGame: normalizePointScore(payload.currentGame),
    serverSide: payload.serverSide ?? null,
    serverSideResolved: payload.serverSideResolved ?? payload.serverSide ?? null,
    serverSideSource: payload.serverSideSource ?? 'unknown',
    serveConfidence: payload.serveConfidence ?? 'low',
    serverPlayerName: normalizeNullableText(payload.serverPlayerName),
    stats: normalizeStats(payload.stats),
    sets: Array.isArray(payload.sets) ? payload.sets.map((set) => normalizeSetScore(set)).filter(Boolean) as TennisFeedSetScore[] : [],
    matchUrl: normalizeNullableText(payload.matchUrl),
    sourcePageUrl: normalizeText(payload.sourcePageUrl ?? payload.matchUrl ?? ''),
  }
}
