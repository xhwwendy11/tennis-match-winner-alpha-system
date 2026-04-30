export interface ItfPlayerOverviewResponse {
  playerId?: number
  firstName?: string
  lastName?: string
  fullName?: string
  nationalityCode?: string
  nationality?: string
  age?: number
  dateOfBirth?: string
  currentCombinedRank?: number
  currentDoublesRank?: number
  currentSinglesRank?: number
  currentWtnRank?: number
  hand?: string
  height?: string
}

export interface ItfPlayerWinLossResponse {
  winLoss?: {
    singles?: {
      overall?: {
        wins?: number
        losses?: number
        winPercentage?: number
      }
      hard?: {
        wins?: number
        losses?: number
        winPercentage?: number
      }
      clay?: {
        wins?: number
        losses?: number
        winPercentage?: number
      }
      grass?: {
        wins?: number
        losses?: number
        winPercentage?: number
      }
    }
  }
}

export interface ItfPlayerBaseline {
  source: 'itf'
  playerId: string | null
  firstName: string | null
  lastName: string | null
  fullName: string | null
  nationality: string | null
  age: number | null
  dateOfBirth: string | null
  currentSinglesRank: number | null
  currentDoublesRank: number | null
  currentCombinedRank: number | null
  currentWtnRank: number | null
  plays: string | null
  height: string | null
  overview: {
    overallWon: number | null
    overallLost: number | null
    overallWinPercentage: number | null
    hardWinPercentage: number | null
    clayWinPercentage: number | null
    grassWinPercentage: number | null
  }
  serve: {
    aces: number | null
    doubleFaults: number | null
    firstServePercentage: number | null
    firstServePointsWonPercentage: number | null
    secondServePointsWonPercentage: number | null
    breakPointsSavedPercentage: number | null
    servicePointsWonPercentage: number | null
    serviceGamesPlayed: number | null
    serviceGamesWonPercentage: number | null
  }
  return: {
    firstServeReturnPointsWonPercentage: number | null
    secondServeReturnPointsWonPercentage: number | null
    breakPointsConvertedPercentage: number | null
    returnGamesPlayed: number | null
    returnGamesWonPercentage: number | null
    returnPointsWonPercentage: number | null
  }
}
