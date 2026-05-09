export type PFairSource = 'none' | 'baseline' | 'derived'
export type PFairSide = 'teamA' | 'teamB'

export interface PFairState {
  version: 'p-fair/v1'
  point: {
    serverSide: PFairSide | null
    pPointA: number | null
    pPointB: number | null
    source: PFairSource
  }
  game: {
    serverSide: PFairSide | null
    pGameA: number | null
    pGameB: number | null
    pHoldServer: number | null
    pBreakReceiver: number | null
    source: PFairSource
  }
  set: {
    pSetA: number | null
    pSetB: number | null
    source: PFairSource
  }
  match: {
    pMatchA: number | null
    pMatchB: number | null
    source: PFairSource
  }
  anchor: {
    prematchFairProbA: number | null
    prematchFairProbB: number | null
    pointBaselineA?: number | null
    pointBaselineB?: number | null
    holdBaselineA: number | null
    holdBaselineB: number | null
    breakBaselineA: number | null
    breakBaselineB: number | null
  }
  diagnostics: {
    setIndex: number | null
    isTiebreak: boolean
    pointScoreA: string | null
    pointScoreB: string | null
    gameScoreA: number | null
    gameScoreB: number | null
    riskRule: string | null
    integrity: string | null
    statsAdjustmentA: number | null
    statsAdjustmentB: number | null
    pointBaselineA?: number | null
    pointBaselineB?: number | null
    firstServeInLiveA?: number | null
    firstServeInLiveB?: number | null
    firstServeWonLiveA?: number | null
    firstServeWonLiveB?: number | null
    secondServeWonLiveA?: number | null
    secondServeWonLiveB?: number | null
    pointLiveA?: number | null
    pointLiveB?: number | null
    pointFairA?: number | null
    pointFairB?: number | null
    liveSampleA?: number | null
    liveSampleB?: number | null
    priorKA?: number | null
    priorKB?: number | null
    preWeightA?: number | null
    preWeightB?: number | null
    liveWeightA?: number | null
    liveWeightB?: number | null
  }
}
