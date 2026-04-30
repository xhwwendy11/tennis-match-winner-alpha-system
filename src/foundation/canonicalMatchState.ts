import type { TennisFeedMatch, TennisMatchStatus } from '../realtime-score/tennis/types.js'

export type MatchIntegrity = 'ok' | 'score_incomplete' | 'serve_incomplete' | 'unsupported_doubles' | 'state_conflict'
export type ServeSyncState = 'synced' | 'raw_only' | 'unknown'
export type TourType = 'ATP' | 'WTA' | 'ATP_CHALLENGER' | 'WTA_CHALLENGER' | 'ITF' | 'UNKNOWN'
export type CompetitionGender = 'men' | 'women' | 'unknown'
export type MatchDiscipline = 'singles' | 'doubles' | 'unknown'
export type AbnormalReason =
  | 'none'
  | 'retired'
  | 'suspended'
  | 'interrupted'
  | 'walkover'
  | 'incomplete'

export interface CanonicalMatchState {
  matchId: string | null
  source: {
    sourceKind: 'flashscore'
    matchUrl: string | null
    sourcePageUrl: string | null
  }
  competition: {
    tournamentName: string | null
    tournamentLabel: string | null
    tournamentPath: string | null
    round: string | null
    bestOf: 3 | null
    tourType: TourType
    gender: CompetitionGender
    discipline: MatchDiscipline
    startTimeISO: string | null
  }
  participants: {
    teamA: {
      name: string | null
      shortName: string | null
      code: string | null
      slug: string | null
      playerId: string | null
    }
    teamB: {
      name: string | null
      shortName: string | null
      code: string | null
      slug: string | null
      playerId: string | null
    }
  }
  status: {
    matchStatus: TennisMatchStatus
    statusText: string
    abnormalReason: AbnormalReason
  }
  scoreboard: {
    setIndex: number | null
    setsWonA: number | null
    setsWonB: number | null
    currentSetGamesA: number | null
    currentSetGamesB: number | null
    currentGamePointsA: string | null
    currentGamePointsB: string | null
    isTiebreak: boolean
  }
  serve: {
    raw: 'teamA' | 'teamB' | null
    resolved: 'teamA' | 'teamB' | null
    source: 'dom' | 'retry' | 'unknown'
    confidence: 'high' | 'low'
    syncState: ServeSyncState
  }
  quality: {
    matchIntegrity: MatchIntegrity
  }
  stats: {
    acesA: number | null
    acesB: number | null
    firstServePercentageA: string | null
    firstServePercentageB: string | null
    pointsWonA: number | null
    pointsWonB: number | null
    firstServeWonA: string | null
    firstServeWonB: string | null
    secondServeWonA: string | null
    secondServeWonB: string | null
    servicePointsWonA: string | null
    servicePointsWonB: string | null
    firstServeReturnPointsWonA: string | null
    firstServeReturnPointsWonB: string | null
    secondServeReturnPointsWonA: string | null
    secondServeReturnPointsWonB: string | null
    returnPointsWonA: string | null
    returnPointsWonB: string | null
    serviceGamesWonA: number | null
    serviceGamesWonB: number | null
    returnGamesWonA: string | null
    returnGamesWonB: string | null
    breakPointsSavedA: string | null
    breakPointsSavedB: string | null
    breakPointsConvertedA: string | null
    breakPointsConvertedB: string | null
    breakPointsDisplayA: string | null
    breakPointsDisplayB: string | null
    doubleFaultsA: number | null
    doubleFaultsB: number | null
  }
  timestamps: {
    ingestedAt: string
    scoreTimestamp: string | null
    serveTimestamp: string | null
    statsTimestamp: string | null
  }
}

function inferTourType(match: TennisFeedMatch): TourType {
  const combined = `${match.tournamentName || ''} ${match.tournamentLabel || ''} ${match.tournamentPath || ''} ${match.sourcePageUrl || ''}`.toLowerCase()
  if (/\bitf\b/.test(combined) || /\b[wm](15|25|35|50|60|75|100)\b/.test(combined)) return 'ITF'
  if (/\bwta\b/.test(combined) && /\b125\b/.test(combined)) return 'WTA'
  if (/challenger-men-singles/.test(combined)) return 'ATP_CHALLENGER'
  if (/challenger-women-singles/.test(combined)) return 'WTA'
  if (/atp-singles/.test(combined)) return 'ATP'
  if (/wta-singles/.test(combined)) return 'WTA'
  if (/\bwta\b/.test(combined) && /\bchallenger\b/.test(combined)) return 'WTA'
  if (/\batp\b/.test(combined) && /\bchallenger\b/.test(combined)) return 'ATP_CHALLENGER'
  if (/\bwta\b/.test(combined)) return 'WTA'
  if (/\batp\b/.test(combined)) return 'ATP'
  return 'UNKNOWN'
}

function inferCompetitionGender(match: TennisFeedMatch): CompetitionGender {
  const combined = `${match.tournamentName || ''} ${match.tournamentLabel || ''} ${match.tournamentPath || ''} ${match.sourcePageUrl || ''}`.toLowerCase()
  if (/kxitfwmatch|itf-womens-match|women|wta|w(15|25|35|50|60|75|100)|challenger-women-singles|wta-singles/.test(combined)) {
    return 'women'
  }
  if (/kxitfmatch|itf-mens-match|men|atp|m(15|25|35|50|60|75|100)|challenger-men-singles|atp-singles/.test(combined)) {
    return 'men'
  }
  return 'unknown'
}

function inferMatchDiscipline(match: TennisFeedMatch): MatchDiscipline {
  const combined = `${match.tournamentName || ''} ${match.tournamentLabel || ''} ${match.tournamentPath || ''} ${match.sourcePageUrl || ''} ${match.teamA.name || ''} ${match.teamB.name || ''}`.toLowerCase()
  if (/doubles/.test(combined) || String(match.teamA.name || '').includes('/') || String(match.teamB.name || '').includes('/')) {
    return 'doubles'
  }
  if (/singles|atp|wta|itf|challenger/.test(combined)) return 'singles'
  return 'unknown'
}

export function inferCompetitionGenderFromKalshiUrl(kalshiMarketUrl: string | null | undefined): CompetitionGender {
  const text = String(kalshiMarketUrl || '').toLowerCase()
  if (/kxitfwmatch|itf-womens-match|kxwtamatch|wta-tennis-match/.test(text)) return 'women'
  if (/kxitfmatch|itf-mens-match|kxatpmatch|atp-tennis-match|kxatpchallengermatch|challenger-atp/.test(text)) return 'men'
  return 'unknown'
}

export function withCompetitionGender(
  state: CanonicalMatchState | null,
  gender: CompetitionGender,
): CanonicalMatchState | null {
  if (!state || gender === 'unknown' || state.competition.gender === gender) return state
  return {
    ...state,
    competition: {
      ...state.competition,
      gender,
    },
  }
}

function abnormalReasonFor(match: TennisFeedMatch): AbnormalReason {
  const text = String(match.statusText || '').toLowerCase()
  if (/\bwalkover\b|\bw\/o\b/.test(text)) return 'walkover'
  if (/\bret(?:ired)?\b/.test(text)) return 'retired'
  if (/\binterrupt(?:ed|ion)?\b/.test(text)) return 'interrupted'
  if (/\bsuspend(?:ed)?\b|\babandon(?:ed)?\b/.test(text)) return 'suspended'
  if (match.status === 'LIVE' && (!match.currentSet || !match.currentGame)) return 'incomplete'
  return 'none'
}

function integrityFor(match: TennisFeedMatch): MatchIntegrity {
  if (inferMatchDiscipline(match) === 'doubles') return 'unsupported_doubles'
  if (match.status === 'LIVE' && (!match.currentSet || !match.currentGame)) return 'score_incomplete'
  if (match.status === 'LIVE' && !match.serverSideResolved && !match.serverSide) return 'serve_incomplete'
  return 'ok'
}

function serveSyncStateFor(match: TennisFeedMatch): ServeSyncState {
  if (match.serverSideResolved) return 'synced'
  if (match.serverSide) return 'raw_only'
  return 'unknown'
}

function setIndexFor(match: TennisFeedMatch): number | null {
  if (match.currentSet?.label) {
    const found = String(match.currentSet.label).match(/\bset\s*(\d+)/i)
    if (found) return Number(found[1])
  }
  return match.sets.length > 0 ? match.sets.length : null
}

export function buildCanonicalMatchState(match: TennisFeedMatch | null): CanonicalMatchState | null {
  if (!match) return null

  const ingestedAt = new Date().toISOString()
  const hasScorePayload = !!match.currentSet || !!match.currentGame

  return {
    matchId: match.eventId || null,
    source: {
      sourceKind: 'flashscore',
      matchUrl: match.matchUrl || null,
      sourcePageUrl: match.sourcePageUrl || null,
    },
    competition: {
      tournamentName: match.tournamentName || null,
      tournamentLabel: match.tournamentLabel || null,
      tournamentPath: match.tournamentPath || null,
      round: match.round || null,
      bestOf: 3,
      tourType: inferTourType(match),
      gender: inferCompetitionGender(match),
      discipline: inferMatchDiscipline(match),
      startTimeISO: match.startTimeISO || null,
    },
    participants: {
      teamA: {
        name: match.teamA.name || null,
        shortName: match.teamA.shortName || null,
        code: match.teamA.code || null,
        slug: match.teamA.slug || null,
        playerId: match.teamA.playerId || null,
      },
      teamB: {
        name: match.teamB.name || null,
        shortName: match.teamB.shortName || null,
        code: match.teamB.code || null,
        slug: match.teamB.slug || null,
        playerId: match.teamB.playerId || null,
      },
    },
    status: {
      matchStatus: match.status,
      statusText: match.statusText,
      abnormalReason: abnormalReasonFor(match),
    },
    scoreboard: {
      setIndex: setIndexFor(match),
      setsWonA: match.teamA.score,
      setsWonB: match.teamB.score,
      currentSetGamesA: match.currentSet ? Number(match.currentSet.teamAScore) : null,
      currentSetGamesB: match.currentSet ? Number(match.currentSet.teamBScore) : null,
      currentGamePointsA: match.currentGame?.teamAScore || null,
      currentGamePointsB: match.currentGame?.teamBScore || null,
      isTiebreak: /tiebreak/i.test(String(match.currentSet?.label || '')),
    },
    serve: {
      raw: match.serverSide,
      resolved: match.serverSideResolved,
      source: match.serverSideSource,
      confidence: match.serveConfidence,
      syncState: serveSyncStateFor(match),
    },
    quality: {
      matchIntegrity: integrityFor(match),
    },
    stats: {
      acesA: match.stats?.acesA ?? null,
      acesB: match.stats?.acesB ?? null,
      firstServePercentageA: match.stats?.firstServePercentageA ?? null,
      firstServePercentageB: match.stats?.firstServePercentageB ?? null,
      pointsWonA: match.stats?.pointsWonA ?? null,
      pointsWonB: match.stats?.pointsWonB ?? null,
      firstServeWonA: match.stats?.firstServeWonA ?? null,
      firstServeWonB: match.stats?.firstServeWonB ?? null,
      secondServeWonA: match.stats?.secondServeWonA ?? null,
      secondServeWonB: match.stats?.secondServeWonB ?? null,
      servicePointsWonA: match.stats?.servicePointsWonA ?? null,
      servicePointsWonB: match.stats?.servicePointsWonB ?? null,
      firstServeReturnPointsWonA: match.stats?.firstServeReturnPointsWonA ?? null,
      firstServeReturnPointsWonB: match.stats?.firstServeReturnPointsWonB ?? null,
      secondServeReturnPointsWonA: match.stats?.secondServeReturnPointsWonA ?? null,
      secondServeReturnPointsWonB: match.stats?.secondServeReturnPointsWonB ?? null,
      returnPointsWonA: match.stats?.returnPointsWonA ?? null,
      returnPointsWonB: match.stats?.returnPointsWonB ?? null,
      serviceGamesWonA: match.stats?.serviceGamesWonA ?? null,
      serviceGamesWonB: match.stats?.serviceGamesWonB ?? null,
      returnGamesWonA: match.stats?.returnGamesWonA ?? null,
      returnGamesWonB: match.stats?.returnGamesWonB ?? null,
      breakPointsSavedA: match.stats?.breakPointsSavedA ?? null,
      breakPointsSavedB: match.stats?.breakPointsSavedB ?? null,
      breakPointsConvertedA: match.stats?.breakPointsConvertedA ?? null,
      breakPointsConvertedB: match.stats?.breakPointsConvertedB ?? null,
      breakPointsDisplayA: match.stats?.breakPointsDisplayA ?? null,
      breakPointsDisplayB: match.stats?.breakPointsDisplayB ?? null,
      doubleFaultsA: match.stats?.doubleFaultsA ?? null,
      doubleFaultsB: match.stats?.doubleFaultsB ?? null,
    },
    timestamps: {
      ingestedAt,
      scoreTimestamp: hasScorePayload ? ingestedAt : null,
      serveTimestamp: match.serverSideResolved || match.serverSide ? ingestedAt : null,
      statsTimestamp: match.stats ? ingestedAt : null,
    },
  }
}
