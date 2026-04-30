export interface AtpPlayerHeroResponse {
  FirstName?: string
  LastName?: string
  BirthDate?: string
  Age?: number
  NatlId?: string
  Nationality?: string
  HeightCm?: number
  HeightFt?: string
  WeightKg?: number
  Plays?: string
  Backhand?: string
  TurnedPro?: number
  Coach?: string
}

export interface AtpPlayerStatsResponse {
  FirstStatYear?: number
  LastStatYear?: number
  Stats?: {
    PlayerId?: string
    RankDate?: string
    Category?: string
    Surface?: string
    EventYear?: number
    ServiceRecordStats?: {
      Aces?: number
      DoubleFaults?: number
      FirstServePercentage?: number
      FirstServePointsWonPercentage?: number
      SecondServePointsWonPercentage?: number
      BreakPointsFaced?: number
      BreakPointsSavedPercentage?: number
      ServiceGamesPlayed?: number
      ServiceGamesWonPercentage?: number
      TotalServicePointsWonPercentage?: number
    }
    ReturnRecordStats?: {
      FirstServeReturnPointsWonPercentage?: number
      SecondServeReturnPointsWonPercentage?: number
      BreakPointsOpportunities?: number
      BreakPointsConvertedPercentage?: number
      ReturnGamesPlayed?: number
      ReturnGamesWonPercentage?: number
      ReturnPointsWonPercentage?: number
      TotalPointsWonPercentage?: number
    }
  }
}

export interface AtpPlayerBaseline {
  source: 'atp'
  playerId: string | null
  firstName: string | null
  lastName: string | null
  nationality: string | null
  age: number | null
  plays: string | null
  turnedPro: number | null
  heightCm: number | null
  statYearFrom: number | null
  statYearTo: number | null
  category: string | null
  surface: string | null
  rankDate: string | null
  serve: {
    aces: number | null
    doubleFaults: number | null
    firstServePercentage: number | null
    firstServePointsWonPercentage: number | null
    secondServePointsWonPercentage: number | null
    breakPointsFaced: number | null
    breakPointsSavedPercentage: number | null
    serviceGamesPlayed: number | null
    serviceGamesWonPercentage: number | null
    totalServicePointsWonPercentage: number | null
  }
  return: {
    firstServeReturnPointsWonPercentage: number | null
    secondServeReturnPointsWonPercentage: number | null
    breakPointsOpportunities: number | null
    breakPointsConvertedPercentage: number | null
    returnGamesPlayed: number | null
    returnGamesWonPercentage: number | null
    returnPointsWonPercentage: number | null
    totalPointsWonPercentage: number | null
  }
}

