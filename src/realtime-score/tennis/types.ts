export type TennisEventType = 'atp' | 'wta' | 'atp_challenger' | 'wta_challenger'

export type TennisMatchStatus = 'PRE' | 'LIVE' | 'FINAL' | 'UNKNOWN'

export interface TennisMarketRef {
  marketId: string
  eventType: TennisEventType
  marketName: string
  startTimeISO: string | null
  flashscoreMatchUrl: string | null
  teamA: string
  teamB: string
}

export interface TennisTournamentLink {
  url: string
  slug: string
  label: string
  count: number
  score: number
}

export interface TennisFeedSetScore {
  label: string
  teamAScore: string
  teamBScore: string
}

export interface TennisFeedScorePair {
  teamAScore: string
  teamBScore: string
}

export interface TennisFeedTeamStats {
  acesA: number | null
  acesB: number | null
  doubleFaultsA: number | null
  doubleFaultsB: number | null
  firstServePercentageA: string | null
  firstServePercentageB: string | null
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
  breakPointsSavedA: string | null
  breakPointsSavedB: string | null
  breakPointsConvertedA: string | null
  breakPointsConvertedB: string | null
  serviceGamesPlayedA: string | null
  serviceGamesPlayedB: string | null
  returnGamesPlayedA: string | null
  returnGamesPlayedB: string | null
  returnGamesWonA: string | null
  returnGamesWonB: string | null
  pointsWonA: number | null
  pointsWonB: number | null
  serviceGamesWonA: number | null
  serviceGamesWonB: number | null
  breakPointsDisplayA: string | null
  breakPointsDisplayB: string | null
}

export interface TennisFeedMatch {
  eventId: string
  tournamentName: string
  tournamentPath: string | null
  tournamentLabel: string
  round: string
  startTimeISO: string | null
  status: TennisMatchStatus
  statusText: string
  teamA: {
    name: string
    shortName: string
    code: string
    slug: string
    playerId: string
    score: number | null
  }
  teamB: {
    name: string
    shortName: string
    code: string
    slug: string
    playerId: string
    score: number | null
  }
  currentSet: TennisFeedSetScore | null
  currentGame: TennisFeedScorePair | null
  serverSide: 'teamA' | 'teamB' | null
  serverSideResolved: 'teamA' | 'teamB' | null
  serverSideSource: 'dom' | 'retry' | 'unknown'
  serveConfidence: 'high' | 'low'
  serverPlayerName: string | null
  stats: TennisFeedTeamStats | null
  sets: TennisFeedSetScore[]
  matchUrl: string | null
  sourcePageUrl: string
}

export interface TennisFlashscoreHistoryRow {
  kind?: string
  time?: string
  score?: string
  action?: string
}

export interface TennisLookupMatch {
  homeTeam: string
  awayTeam: string
  homeScore: number | string | null
  awayScore: number | string | null
  startTime: string | null
  league: string | null
  status: TennisMatchStatus
  statusText: string
  round: string | null
  currentSet: TennisFeedSetScore | null
  currentGame: TennisFeedScorePair | null
  serverSide: 'teamA' | 'teamB' | null
  serverSideResolved: 'teamA' | 'teamB' | null
  serverSideSource: 'dom' | 'retry' | 'unknown'
  serveConfidence: 'high' | 'low'
  serverPlayerName: string | null
  sets: TennisFeedSetScore[]
  detailSummary: string | null
  matchUrl: string | null
  sourcePageUrl: string | null
  history: TennisFlashscoreHistoryRow[]
}

export interface TennisLookupResult {
  marketId: string
  sourceKind: 'flashscore'
  sourceLabel: string
  sourceUrl: string
  asOf: string
  cacheMs: number
  fetchedFromCache: boolean
  fetchLatencyMs: number
  pageFetchCount: number
  matched: boolean
  matchedBy: 'full_name' | 'surname' | 'manual_override' | 'not_found'
  eventType: TennisEventType
  searchedTournamentUrls: string[]
  match: TennisLookupMatch | null
}

export interface TennisMarketScoreRecord {
  marketId: string
  eventType: TennisEventType
  marketName: string
  teamA: string
  teamB: string
  matched: boolean
  matchedBy: TennisLookupResult['matchedBy']
  status: TennisMatchStatus
  statusText: string
  homeScore: number | string | null
  awayScore: number | string | null
  league: string | null
  round: string | null
  currentSet: TennisFeedSetScore | null
  currentGame: TennisFeedScorePair | null
  sets: TennisFeedSetScore[]
  detailSummary: string | null
  matchUrl: string | null
  asOf: string
}

export interface TennisTokenPayload {
  league: 'tennis'
  mode: 'full'
  asOf: string
  totalMarkets: number
  totalMatchedMarkets: number
  records: TennisMarketScoreRecord[]
}
