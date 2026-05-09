import type { CanonicalMatchState } from '../foundation/canonicalMatchState.js'
import { clampProbability, normalizeTwoWayProbabilities, type PrematchBaseline } from '../foundation/prematchBaseline.js'
import type { ResolvedStats } from '../foundation/resolvedStats.js'
import { DEFAULT_PFAIR_CONFIG } from '../probability/config.js'
import type { TennisPointRiskDecision } from '../rules/tennis/pointRiskEngine.js'
import type { PFairSide, PFairSource, PFairState } from './types.js'

function pointScoreToNumber(value: string | null | undefined): number | 'AD' | null {
  const normalized = String(value || '').trim().toUpperCase()
  if (!normalized) return null
  if (normalized === 'AD') return 'AD'
  if (normalized === '0') return 0
  if (normalized === '15') return 1
  if (normalized === '30') return 2
  if (normalized === '40') return 3
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

function currentPointState(state: CanonicalMatchState | null): { a: number | 'AD' | null; b: number | 'AD' | null } {
  return {
    a: pointScoreToNumber(state?.scoreboard.currentGamePointsA ?? null),
    b: pointScoreToNumber(state?.scoreboard.currentGamePointsB ?? null),
  }
}

function safeNumber(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function ratioParts(value: string | null | undefined): { made: number; total: number } | null {
  const text = String(value || '').trim()
  if (!text) return null

  const parenMatch = text.match(/\((\d+)\s*\/\s*(\d+)\)/)
  if (parenMatch) {
    const made = Number(parenMatch[1])
    const total = Number(parenMatch[2])
    return Number.isFinite(made) && Number.isFinite(total) && total > 0 ? { made, total } : null
  }

  const directMatch = text.match(/(\d+)\s*\/\s*(\d+)/)
  if (directMatch) {
    const made = Number(directMatch[1])
    const total = Number(directMatch[2])
    return Number.isFinite(made) && Number.isFinite(total) && total > 0 ? { made, total } : null
  }

  return null
}

function ratioRate(value: string | null | undefined): number | null {
  const parts = ratioParts(value)
  if (!parts || parts.total <= 0) return null
  return parts.made / parts.total
}

function percentageRate(value: string | null | undefined): number | null {
  const text = String(value || '').trim()
  if (!text) return null
  const pctMatch = text.match(/(\d+(?:\.\d+)?)\s*%/)
  if (pctMatch) {
    const pct = Number(pctMatch[1])
    return Number.isFinite(pct) ? pct / 100 : null
  }
  const asNumber = Number(text)
  if (Number.isFinite(asNumber)) {
    if (asNumber > 1) return asNumber / 100
    if (asNumber >= 0) return asNumber
  }
  return null
}

function statsAdjustment(input: {
  resolvedStats?: ResolvedStats | null
}): { adjustA: number; adjustB: number } {
  const stats = input.resolvedStats
  if (!stats) return { adjustA: 0, adjustB: 0 }

  let adjustA = 0
  let adjustB = 0
  const weights = DEFAULT_PFAIR_CONFIG.statsWeights

  const pointsA = safeNumber(stats.pointsWonA.value)
  const pointsB = safeNumber(stats.pointsWonB.value)
  if (pointsA != null && pointsB != null && pointsA + pointsB > 0) {
    const edge = (pointsA - pointsB) / (pointsA + pointsB)
    adjustA += edge * weights.pointsWon
    adjustB -= edge * weights.pointsWon
  }

  const serviceGamesWonA = safeNumber(stats.serviceGamesWonA.value)
  const serviceGamesWonB = safeNumber(stats.serviceGamesWonB.value)
  if (serviceGamesWonA != null && serviceGamesWonB != null && serviceGamesWonA + serviceGamesWonB > 0) {
    const edge = (serviceGamesWonA - serviceGamesWonB) / (serviceGamesWonA + serviceGamesWonB)
    adjustA += edge * weights.serviceGamesWon
    adjustB -= edge * weights.serviceGamesWon
  }

  const doubleFaultsA = safeNumber(stats.doubleFaultsA.value)
  const doubleFaultsB = safeNumber(stats.doubleFaultsB.value)
  if (doubleFaultsA != null && doubleFaultsB != null) {
    const diff = Math.max(-6, Math.min(6, doubleFaultsB - doubleFaultsA))
    adjustA += diff * weights.doubleFaultsPerDiff
    adjustB -= diff * weights.doubleFaultsPerDiff
  }

  const returnPointsWonA = ratioRate(stats.returnPointsWonA?.value)
  const returnPointsWonB = ratioRate(stats.returnPointsWonB?.value)
  if (returnPointsWonA != null && returnPointsWonB != null) {
    const edge = returnPointsWonA - returnPointsWonB
    adjustA += edge * weights.returnPointsWon
    adjustB -= edge * weights.returnPointsWon
  }

  const firstServeReturnA = ratioRate(stats.firstServeReturnPointsWonA?.value)
  const firstServeReturnB = ratioRate(stats.firstServeReturnPointsWonB?.value)
  if (firstServeReturnA != null && firstServeReturnB != null) {
    const edge = firstServeReturnA - firstServeReturnB
    adjustA += edge * weights.firstServeReturnPointsWon
    adjustB -= edge * weights.firstServeReturnPointsWon
  }

  const secondServeReturnA = ratioRate(stats.secondServeReturnPointsWonA?.value)
  const secondServeReturnB = ratioRate(stats.secondServeReturnPointsWonB?.value)
  if (secondServeReturnA != null && secondServeReturnB != null) {
    const edge = secondServeReturnA - secondServeReturnB
    adjustA += edge * weights.secondServeReturnPointsWon
    adjustB -= edge * weights.secondServeReturnPointsWon
  }

  const breakSavedA = ratioRate(stats.breakPointsSavedA?.value)
  const breakSavedB = ratioRate(stats.breakPointsSavedB?.value)
  if (breakSavedA != null && breakSavedB != null) {
    const edge = breakSavedA - breakSavedB
    adjustA += edge * weights.breakPointsSaved
    adjustB -= edge * weights.breakPointsSaved
  }

  const breakConvertedA = ratioRate(stats.breakPointsConvertedA?.value)
  const breakConvertedB = ratioRate(stats.breakPointsConvertedB?.value)
  if (breakConvertedA != null && breakConvertedB != null) {
    const edge = breakConvertedA - breakConvertedB
    adjustA += edge * weights.breakPointsConverted
    adjustB -= edge * weights.breakPointsConverted
  }

  return {
    adjustA: Math.max(-weights.maxAbsoluteAdjustment, Math.min(weights.maxAbsoluteAdjustment, adjustA)),
    adjustB: Math.max(-weights.maxAbsoluteAdjustment, Math.min(weights.maxAbsoluteAdjustment, adjustB)),
  }
}

function liveServePointProb(input: {
  firstServePercentage: string | null | undefined
  firstServeWon: string | null | undefined
  secondServeWon: string | null | undefined
}): {
  prob: number | null
  sample: number
  firstServeInRate: number | null
  firstServeWonRate: number | null
  secondServeWonRate: number | null
} {
  const first = ratioParts(input.firstServeWon)
  const second = ratioParts(input.secondServeWon)
  const made = (first?.made ?? 0) + (second?.made ?? 0)
  const total = (first?.total ?? 0) + (second?.total ?? 0)
  const firstServeWonRate = first && first.total > 0 ? first.made / first.total : null
  const secondServeWonRate = second && second.total > 0 ? second.made / second.total : null
  const firstServeInRateFromPct = percentageRate(input.firstServePercentage)
  const firstServeInRateFromCounts = total > 0 && first ? first.total / total : null
  const firstServeInRate = firstServeInRateFromPct ?? firstServeInRateFromCounts

  if (
    firstServeInRate != null &&
    firstServeWonRate != null &&
    secondServeWonRate != null
  ) {
    const prob = clampProbability(
      firstServeInRate * firstServeWonRate + (1 - firstServeInRate) * secondServeWonRate,
    )
    return {
      prob,
      sample: total,
      firstServeInRate,
      firstServeWonRate,
      secondServeWonRate,
    }
  }

  if (total <= 0) {
    return {
      prob: null,
      sample: 0,
      firstServeInRate,
      firstServeWonRate,
      secondServeWonRate,
    }
  }
  return {
    prob: clampProbability(made / total),
    sample: total,
    firstServeInRate,
    firstServeWonRate,
    secondServeWonRate,
  }
}

function baselineServePointProb(input: {
  baseline: PrematchBaseline
  serverSide: PFairSide | null
}): number | null {
  const serverSide = input.serverSide
  if (!serverSide) return null

  const pointBaseline =
    serverSide === 'teamA' ? input.baseline.pointBaselineA ?? null : input.baseline.pointBaselineB ?? null
  if (pointBaseline != null) return clampProbability(pointBaseline)

  const holdBaseline =
    serverSide === 'teamA' ? input.baseline.holdBaselineA : input.baseline.holdBaselineB
  if (holdBaseline == null) return null

  return clampProbability(0.5 + (holdBaseline - 0.5) * DEFAULT_PFAIR_CONFIG.holdToPointScale)
}

function pointPriorStrength(state: CanonicalMatchState | null): number {
  const setIndex = state?.scoreboard.setIndex ?? 1
  const setsWonA = state?.scoreboard.setsWonA ?? 0
  const setsWonB = state?.scoreboard.setsWonB ?? 0
  const bestOf = state?.competition.bestOf ?? 3
  const decidingThreshold = bestOf === 5 ? 2 : 1
  const isDecidingSet = setsWonA >= decidingThreshold && setsWonB >= decidingThreshold

  if (isDecidingSet) return 15
  if (setIndex >= 3) return 20
  if (setIndex === 2) return 30
  return 50
}

function blendFairServePointProb(input: {
  state: CanonicalMatchState | null
  baseline: PrematchBaseline
  resolvedStats?: ResolvedStats | null
}): {
  pointBaselineA: number | null
  pointBaselineB: number | null
  firstServeInLiveA: number | null
  firstServeInLiveB: number | null
  firstServeWonLiveA: number | null
  firstServeWonLiveB: number | null
  secondServeWonLiveA: number | null
  secondServeWonLiveB: number | null
  pointLiveA: number | null
  pointLiveB: number | null
  pointFairA: number | null
  pointFairB: number | null
  liveSampleA: number
  liveSampleB: number
  priorKA: number
  priorKB: number
  preWeightA: number | null
  preWeightB: number | null
  liveWeightA: number | null
  liveWeightB: number | null
} {
  const pointBaselineA = baselineServePointProb({
    baseline: input.baseline,
    serverSide: 'teamA',
  })
  const pointBaselineB = baselineServePointProb({
    baseline: input.baseline,
    serverSide: 'teamB',
  })

  const liveA = liveServePointProb({
    firstServePercentage: input.resolvedStats?.firstServePercentageA?.value ?? null,
    firstServeWon: input.resolvedStats?.firstServeWonA?.value ?? null,
    secondServeWon: input.resolvedStats?.secondServeWonA?.value ?? null,
  })
  const liveB = liveServePointProb({
    firstServePercentage: input.resolvedStats?.firstServePercentageB?.value ?? null,
    firstServeWon: input.resolvedStats?.firstServeWonB?.value ?? null,
    secondServeWon: input.resolvedStats?.secondServeWonB?.value ?? null,
  })

  const priorK = pointPriorStrength(input.state)
  const preWeightA = pointBaselineA != null ? priorK / (priorK + liveA.sample) : null
  const liveWeightA = pointBaselineA != null ? liveA.sample / (priorK + liveA.sample) : liveA.prob != null ? 1 : null
  const preWeightB = pointBaselineB != null ? priorK / (priorK + liveB.sample) : null
  const liveWeightB = pointBaselineB != null ? liveB.sample / (priorK + liveB.sample) : liveB.prob != null ? 1 : null
  const pointFairA =
    pointBaselineA != null
      ? clampProbability(((priorK * pointBaselineA) + (liveA.sample * (liveA.prob ?? pointBaselineA))) / (priorK + liveA.sample))
      : liveA.prob
  const pointFairB =
    pointBaselineB != null
      ? clampProbability(((priorK * pointBaselineB) + (liveB.sample * (liveB.prob ?? pointBaselineB))) / (priorK + liveB.sample))
      : liveB.prob

  return {
    pointBaselineA,
    pointBaselineB,
    firstServeInLiveA: liveA.firstServeInRate,
    firstServeInLiveB: liveB.firstServeInRate,
    firstServeWonLiveA: liveA.firstServeWonRate,
    firstServeWonLiveB: liveB.firstServeWonRate,
    secondServeWonLiveA: liveA.secondServeWonRate,
    secondServeWonLiveB: liveB.secondServeWonRate,
    pointLiveA: liveA.prob,
    pointLiveB: liveB.prob,
    pointFairA,
    pointFairB,
    liveSampleA: liveA.sample,
    liveSampleB: liveB.sample,
    priorKA: priorK,
    priorKB: priorK,
    preWeightA,
    preWeightB,
    liveWeightA,
    liveWeightB,
  }
}

function baselineServeGameProb(input: {
  pointProb: number | null
  holdFallback: number | null
}): number {
  if (input.pointProb == null) {
    return input.holdFallback ?? 0.5
  }
  return gameWinProbFromStandardPoints(input.pointProb, 0, 0)
}

function pointProbabilitiesForServer(input: {
  fairPoint: ReturnType<typeof blendFairServePointProb>
  serverSide: PFairSide | null
  risk: TennisPointRiskDecision
}): { pPointA: number | null; pPointB: number | null; source: PFairSource; statsAdjustmentA: number; statsAdjustmentB: number } {
  const serverSide = input.serverSide
  if (!serverSide) {
    return {
      pPointA: null,
      pPointB: null,
      source: 'none',
      statsAdjustmentA: 0,
      statsAdjustmentB: 0,
    }
  }

  let pPointServer = serverSide === 'teamA' ? input.fairPoint.pointFairA : input.fairPoint.pointFairB
  if (pPointServer == null) {
    return {
      pPointA: null,
      pPointB: null,
      source: 'none',
      statsAdjustmentA: 0,
      statsAdjustmentB: 0,
    }
  }

  const stats = { adjustA: 0, adjustB: 0 }

  const risk = input.risk.finalRisk
  if (risk === 'high') pPointServer -= DEFAULT_PFAIR_CONFIG.riskAdjustments.high
  if (risk === 'very_high') pPointServer -= DEFAULT_PFAIR_CONFIG.riskAdjustments.veryHigh
  if (input.risk.stopTriggered) pPointServer -= DEFAULT_PFAIR_CONFIG.riskAdjustments.stopTriggered
  pPointServer += serverSide === 'teamA' ? stats.adjustA : stats.adjustB
  pPointServer = clampProbability(pPointServer) ?? null

  if (pPointServer == null) {
    return { pPointA: null, pPointB: null, source: 'none', statsAdjustmentA: stats.adjustA, statsAdjustmentB: stats.adjustB }
  }

  return serverSide === 'teamA'
    ? { pPointA: pPointServer, pPointB: 1 - pPointServer, source: 'derived', statsAdjustmentA: stats.adjustA, statsAdjustmentB: stats.adjustB }
    : { pPointA: 1 - pPointServer, pPointB: pPointServer, source: 'derived', statsAdjustmentA: stats.adjustA, statsAdjustmentB: stats.adjustB }
}

function gameWinProbFromStandardPoints(serverWinsPoint: number, serverPoints: number, receiverPoints: number, memo = new Map<string, number>()): number {
  const key = `${serverPoints}:${receiverPoints}:${serverWinsPoint.toFixed(6)}`
  const cached = memo.get(key)
  if (cached != null) return cached

  if (serverPoints >= 4 && serverPoints - receiverPoints >= 2) return 1
  if (receiverPoints >= 4 && receiverPoints - serverPoints >= 2) return 0

  if (serverPoints >= 3 && receiverPoints >= 3) {
    if (serverPoints === receiverPoints) {
      const p = serverWinsPoint
      const denom = 1 - 2 * p * (1 - p)
      return denom <= 0 ? 0.5 : (p * p) / denom
    }
    if (serverPoints === receiverPoints + 1) {
      const p = serverWinsPoint
      const deuce = gameWinProbFromStandardPoints(serverWinsPoint, 3, 3, memo)
      return p + (1 - p) * deuce
    }
    if (receiverPoints === serverPoints + 1) {
      const p = serverWinsPoint
      const deuce = gameWinProbFromStandardPoints(serverWinsPoint, 3, 3, memo)
      return p * deuce
    }
  }

  const value =
    serverWinsPoint * gameWinProbFromStandardPoints(serverWinsPoint, serverPoints + 1, receiverPoints, memo) +
    (1 - serverWinsPoint) * gameWinProbFromStandardPoints(serverWinsPoint, serverPoints, receiverPoints + 1, memo)
  memo.set(key, value)
  return value
}

function tiebreakWinProb(aPointProb: number, bPointProb: number, pointA: number, pointB: number, nextServer: PFairSide | null, memo = new Map<string, number>()): number {
  const key = `${pointA}:${pointB}:${nextServer}:${aPointProb.toFixed(6)}:${bPointProb.toFixed(6)}`
  const cached = memo.get(key)
  if (cached != null) return cached
  if (pointA >= 7 && pointA - pointB >= 2) return 1
  if (pointB >= 7 && pointB - pointA >= 2) return 0
  if (pointA + pointB >= 40) {
    const scorePressure = 0.5 + (pointA - pointB) * 0.08
    const pointPressure = (aPointProb + (1 - bPointProb)) / 2
    return clampProbability((scorePressure + pointPressure) / 2) ?? 0.5
  }

  const block = pointA + pointB
  const server: PFairSide =
    nextServer ??
    (block === 0 ? 'teamA' : Math.floor((block - 1) / 2) % 2 === 0 ? 'teamB' : 'teamA')
  const pAWinPoint = server === 'teamA' ? aPointProb : 1 - bPointProb
  const nextServerAfterPoint =
    block === 0 ? 'teamB' : Math.floor(block / 2) % 2 === 0 ? 'teamB' : 'teamA'

  const value =
    pAWinPoint * tiebreakWinProb(aPointProb, bPointProb, pointA + 1, pointB, nextServerAfterPoint, memo) +
    (1 - pAWinPoint) * tiebreakWinProb(aPointProb, bPointProb, pointA, pointB + 1, nextServerAfterPoint, memo)
  memo.set(key, value)
  return value
}

function parseCurrentGameProb(input: {
  state: CanonicalMatchState | null
  pPointA: number | null
  pPointB: number | null
}): { pGameA: number | null; pGameB: number | null; pHoldServer: number | null; pBreakReceiver: number | null; source: PFairSource } {
  const state = input.state
  const serverSide = state?.serve.resolved ?? null
  if (!state || !serverSide || input.pPointA == null || input.pPointB == null) {
    return {
      pGameA: null,
      pGameB: null,
      pHoldServer: null,
      pBreakReceiver: null,
      source: 'none',
    }
  }

  const point = currentPointState(state)
  const isTiebreak = state.scoreboard.isTiebreak

  let pGameA: number | null = null
  let pGameB: number | null = null

  if (isTiebreak) {
    const a = typeof point.a === 'number' ? point.a : 0
    const b = typeof point.b === 'number' ? point.b : 0
    if (a + b > 80) {
      pGameA = a > b ? 1 : a < b ? 0 : 0.5
    } else {
      pGameA = tiebreakWinProb(input.pPointA, input.pPointB, a, b, serverSide)
    }
    pGameB = 1 - pGameA
  } else {
    const a = point.a === 'AD' ? 4 : typeof point.a === 'number' ? point.a : 0
    const b = point.b === 'AD' ? 4 : typeof point.b === 'number' ? point.b : 0
    if (serverSide === 'teamA') {
      const pHold = gameWinProbFromStandardPoints(input.pPointA, a, b)
      pGameA = pHold
      pGameB = 1 - pHold
    } else {
      const pHold = gameWinProbFromStandardPoints(input.pPointB, b, a)
      pGameB = pHold
      pGameA = 1 - pHold
    }
  }

  const pHoldServer = serverSide === 'teamA' ? pGameA : pGameB
  const pBreakReceiver = pHoldServer == null ? null : 1 - pHoldServer
  return {
    pGameA,
    pGameB,
    pHoldServer,
    pBreakReceiver,
    source: 'derived',
  }
}

function postGameServer(currentServer: PFairSide | null): PFairSide | null {
  if (currentServer === 'teamA') return 'teamB'
  if (currentServer === 'teamB') return 'teamA'
  return null
}

function setWinProb(
  gamesA: number,
  gamesB: number,
  nextServer: PFairSide | null,
  pServeGameA: number,
  pServeGameB: number,
  memo = new Map<string, number>(),
): number {
  const key = `${gamesA}:${gamesB}:${nextServer}:${pServeGameA.toFixed(6)}:${pServeGameB.toFixed(6)}`
  const cached = memo.get(key)
  if (cached != null) return cached

  if (gamesA >= 6 && gamesA - gamesB >= 2) return 1
  if (gamesB >= 6 && gamesB - gamesA >= 2) return 0
  if (gamesA === 6 && gamesB === 6) {
    const tiebreakA = (pServeGameA + (1 - pServeGameB)) / 2
    return clampProbability(tiebreakA) ?? 0.5
  }

  const pAWinNextGame =
    nextServer === 'teamA' ? pServeGameA : nextServer === 'teamB' ? 1 - pServeGameB : 0.5
  const next = postGameServer(nextServer)
  const value =
    pAWinNextGame * setWinProb(gamesA + 1, gamesB, next, pServeGameA, pServeGameB, memo) +
    (1 - pAWinNextGame) * setWinProb(gamesA, gamesB + 1, next, pServeGameA, pServeGameB, memo)
  memo.set(key, value)
  return value
}

function computeSetProb(input: {
  state: CanonicalMatchState | null
  futureServePointA: number | null
  futureServePointB: number | null
  holdFallbackA: number | null
  holdFallbackB: number | null
  currentGame: ReturnType<typeof parseCurrentGameProb>
}): { pSetA: number | null; pSetB: number | null; source: PFairSource } {
  const state = input.state
  if (!state) return { pSetA: null, pSetB: null, source: 'none' }

  const gamesA = state.scoreboard.currentSetGamesA ?? 0
  const gamesB = state.scoreboard.currentSetGamesB ?? 0

  if (input.currentGame.pGameA == null || input.currentGame.pGameB == null) {
    return { pSetA: null, pSetB: null, source: 'none' }
  }

  if (state.scoreboard.isTiebreak) {
    return {
      pSetA: input.currentGame.pGameA,
      pSetB: input.currentGame.pGameB,
      source: 'derived',
    }
  }

  const pServeGameA = baselineServeGameProb({
    pointProb: input.futureServePointA,
    holdFallback: input.holdFallbackA,
  })
  const pServeGameB = baselineServeGameProb({
    pointProb: input.futureServePointB,
    holdFallback: input.holdFallbackB,
  })
  const currentServer = state.serve.resolved ?? null
  const postCurrentServer = postGameServer(currentServer)

  const pSetA =
    input.currentGame.pGameA * setWinProb(gamesA + 1, gamesB, postCurrentServer, pServeGameA, pServeGameB) +
    input.currentGame.pGameB * setWinProb(gamesA, gamesB + 1, postCurrentServer, pServeGameA, pServeGameB)

  return {
    pSetA,
    pSetB: 1 - pSetA,
    source: 'derived',
  }
}

function computeMatchProb(input: {
  state: CanonicalMatchState | null
  baseline: PrematchBaseline
  set: ReturnType<typeof computeSetProb>
  futureSetProbA: number | null
}): { pMatchA: number | null; pMatchB: number | null; source: PFairSource } {
  const state = input.state
  if (!state || input.set.pSetA == null || input.set.pSetB == null) {
    const normalized = normalizeTwoWayProbabilities({
      probA: input.baseline.prematchFairProbA,
      probB: input.baseline.prematchFairProbB,
    })
    if (normalized.probA == null || normalized.probB == null) {
      return { pMatchA: null, pMatchB: null, source: 'none' }
    }
    return {
      pMatchA: normalized.probA,
      pMatchB: normalized.probB,
      source: 'baseline',
    }
  }

  const wonA = state.scoreboard.setsWonA ?? 0
  const wonB = state.scoreboard.setsWonB ?? 0
  const targetSets = (state.competition.bestOf ?? input.baseline.bestOf ?? 3) === 5 ? 3 : 2

  if (wonA >= targetSets) return { pMatchA: 1, pMatchB: 0, source: 'derived' }
  if (wonB >= targetSets) return { pMatchA: 0, pMatchB: 1, source: 'derived' }

  const futureSetProbA = clampProbability(input.futureSetProbA ?? input.baseline.prematchFairProbA ?? 0.5) ?? 0.5
  const memo = new Map<string, number>()
  function recurse(setsA: number, setsB: number, currentSet: boolean): number {
    const key = `${setsA}:${setsB}:${currentSet}:${futureSetProbA.toFixed(6)}:${(input.set.pSetA ?? 0.5).toFixed(6)}`
    const cached = memo.get(key)
    if (cached != null) return cached
    if (setsA >= targetSets) return 1
    if (setsB >= targetSets) return 0

    const setProbA = currentSet ? (input.set.pSetA ?? futureSetProbA) : futureSetProbA
    const value = setProbA * recurse(setsA + 1, setsB, false) + (1 - setProbA) * recurse(setsA, setsB + 1, false)
    memo.set(key, value)
    return value
  }

  const pMatchA = recurse(wonA, wonB, true)
  return {
    pMatchA,
    pMatchB: 1 - pMatchA,
    source: 'derived',
  }
}

export function buildPFairState(input: {
  state: CanonicalMatchState | null
  baseline: PrematchBaseline
  pointRisk: TennisPointRiskDecision
  resolvedStats?: ResolvedStats | null
}): PFairState {
  const state = input.state
  const serverSide = state?.serve.resolved ?? null
  const fairPoint = blendFairServePointProb({
    state,
    baseline: input.baseline,
    resolvedStats: input.resolvedStats,
  })
  const point = pointProbabilitiesForServer({
    fairPoint,
    serverSide,
    risk: input.pointRisk,
  })
  const game = parseCurrentGameProb({
    state,
    pPointA: point.pPointA,
    pPointB: point.pPointB,
  })
  const set = computeSetProb({
    state,
    futureServePointA: fairPoint.pointFairA,
    futureServePointB: fairPoint.pointFairB,
    holdFallbackA: input.baseline.holdBaselineA,
    holdFallbackB: input.baseline.holdBaselineB,
    currentGame: game,
  })
  const futureServeGameA = baselineServeGameProb({
    pointProb: fairPoint.pointFairA,
    holdFallback: input.baseline.holdBaselineA,
  })
  const futureServeGameB = baselineServeGameProb({
    pointProb: fairPoint.pointFairB,
    holdFallback: input.baseline.holdBaselineB,
  })
  const futureSetProbA =
    (setWinProb(0, 0, 'teamA', futureServeGameA, futureServeGameB) + setWinProb(0, 0, 'teamB', futureServeGameA, futureServeGameB)) / 2
  const match = computeMatchProb({
    state,
    baseline: input.baseline,
    set,
    futureSetProbA,
  })

  return {
    version: 'p-fair/v1',
    point: {
      serverSide,
      pPointA: point.pPointA,
      pPointB: point.pPointB,
      source: point.source,
    },
    game: {
      serverSide,
      pGameA: game.pGameA,
      pGameB: game.pGameB,
      pHoldServer: game.pHoldServer,
      pBreakReceiver: game.pBreakReceiver,
      source: game.source,
    },
    set: {
      pSetA: set.pSetA,
      pSetB: set.pSetB,
      source: set.source,
    },
    match: {
      pMatchA: match.pMatchA,
      pMatchB: match.pMatchB,
      source: match.source,
    },
    anchor: {
      prematchFairProbA: input.baseline.prematchFairProbA,
      prematchFairProbB: input.baseline.prematchFairProbB,
      pointBaselineA: input.baseline.pointBaselineA ?? null,
      pointBaselineB: input.baseline.pointBaselineB ?? null,
      holdBaselineA: input.baseline.holdBaselineA,
      holdBaselineB: input.baseline.holdBaselineB,
      breakBaselineA: input.baseline.breakBaselineA,
      breakBaselineB: input.baseline.breakBaselineB,
    },
    diagnostics: {
      setIndex: state?.scoreboard.setIndex ?? null,
      isTiebreak: state?.scoreboard.isTiebreak ?? false,
      pointScoreA: state?.scoreboard.currentGamePointsA ?? null,
      pointScoreB: state?.scoreboard.currentGamePointsB ?? null,
      gameScoreA: state?.scoreboard.currentSetGamesA ?? null,
      gameScoreB: state?.scoreboard.currentSetGamesB ?? null,
      riskRule: input.pointRisk.matchedRule,
      integrity: state?.quality.matchIntegrity ?? null,
      statsAdjustmentA: point.statsAdjustmentA,
      statsAdjustmentB: point.statsAdjustmentB,
      pointBaselineA: fairPoint.pointBaselineA,
      pointBaselineB: fairPoint.pointBaselineB,
      firstServeInLiveA: fairPoint.firstServeInLiveA,
      firstServeInLiveB: fairPoint.firstServeInLiveB,
      firstServeWonLiveA: fairPoint.firstServeWonLiveA,
      firstServeWonLiveB: fairPoint.firstServeWonLiveB,
      secondServeWonLiveA: fairPoint.secondServeWonLiveA,
      secondServeWonLiveB: fairPoint.secondServeWonLiveB,
      pointLiveA: fairPoint.pointLiveA,
      pointLiveB: fairPoint.pointLiveB,
      pointFairA: fairPoint.pointFairA,
      pointFairB: fairPoint.pointFairB,
      liveSampleA: fairPoint.liveSampleA,
      liveSampleB: fairPoint.liveSampleB,
      priorKA: fairPoint.priorKA,
      priorKB: fairPoint.priorKB,
      preWeightA: fairPoint.preWeightA,
      preWeightB: fairPoint.preWeightB,
      liveWeightA: fairPoint.liveWeightA,
      liveWeightB: fairPoint.liveWeightB,
    },
  }
}
