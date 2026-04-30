export interface WtaPlayerYearResponse {
  player?: {
    id?: number
    firstName?: string
    lastName?: string
    fullName?: string
    countryCode?: string
    dateOfBirth?: string
    height?: string
    turnedPro?: number
    plays?: string
    currentSinglesRanking?: number
  }
  overview?: {
    wonLost?: string
    singlesTitles?: number
    prizeMoney?: string
  }
  stats?: {
    matchesPlayed?: number
    aces?: number
    serviceGamesWon?: number
    returnGamesWon?: number
    firstServeWon?: number
    Aces?: number
    Break_Point_Chances?: number
    Break_Points_Converted?: number
    Break_Points_Faced?: number
    Break_Points_Lost?: number
    Current_Rank?: number
    Double_Faults?: number
    First_Return_Won?: number
    First_Serve_Return_Chances?: number
    First_Serves_Played?: number
    First_Serves_Won?: number
    Return_Games_Played?: number
    Second_Return_Chances?: number
    Second_Return_Won?: number
    Second_Serves_Played?: number
    Second_Serves_Won?: number
    Service_Games_Played?: number
    breakpoint_converted_percent?: number
    breakpoint_saved_percent?: number
    first_return_percent?: number
    first_serve_percent?: number
    first_serve_won_percent?: number
    return_games_won_percent?: number
    return_points_won_percent?: number
    second_return_percent?: number
    second_serve_won_percent?: number
    service_games_won_percent?: number
    service_points_won_percent?: number
  }
  servingStats?: {
    aces?: number
    doubleFaults?: number
    firstServePercentage?: number
    firstServeWon?: number
    secondServeWon?: number
    breakPointsSaved?: number
    servicePointsWon?: number
    serviceGamesWon?: number
    serviceGamesPlayed?: number
  }
  returnStats?: {
    returnPointsWon?: number
    firstReturnPointsWon?: number
    secondReturnPointsWon?: number
    breakPointsConverted?: number
    returnGamesWon?: number
    returnGamesPlayed?: number
  }
}

export interface WtaPlayerBaseline {
  source: 'wta'
  playerId: string | null
  firstName: string | null
  lastName: string | null
  countryCode: string | null
  dateOfBirth: string | null
  turnedPro: number | null
  plays: string | null
  currentSinglesRanking: number | null
  year: number | null
  overview: {
    wonLost: string | null
    singlesTitles: number | null
    prizeMoney: string | null
  }
  serve: {
    aces: number | null
    doubleFaults: number | null
    firstServePercentage: number | null
    firstServeWonPercentage: number | null
    secondServeWonPercentage: number | null
    breakPointsSavedPercentage: number | null
    servicePointsWonPercentage: number | null
    serviceGamesWonPercentage: number | null
    serviceGamesPlayed: number | null
  }
  return: {
    returnPointsWonPercentage: number | null
    firstReturnPointsWonPercentage: number | null
    secondReturnPointsWonPercentage: number | null
    breakPointsConvertedPercentage: number | null
    returnGamesWonPercentage: number | null
    returnGamesPlayed: number | null
  }
}
