import type { TennisFeedMatch } from '../../realtime-score/tennis/types.js'

export type RiskLevel = 'low' | 'medium' | 'high' | 'very_high'
export type MachineCommand = 'RUN' | 'WARN' | 'PAUSE' | 'STOP'
export type MatchFormat = 'best_of_3'
export type SetContext = 'normal_set' | 'closing_set' | 'deciding_set'
type Phase = 'non_tiebreak' | 'tiebreak' | 'unknown'
type RuleKind =
  | 'normal'
  | 'break_pressure'
  | 'set_point'
  | 'tiebreak_hot'
  | 'tiebreak_critical'
  | 'opening_game'

type ServerContext =
  | 'any'
  | 'leader_serving'
  | 'trailer_serving'
  | 'small_point_rotation'
  | 'key_point_rotation'
  | 'server_set_point'
  | 'receiver_set_point'

export interface TennisMatchContext {
  matchFormat: MatchFormat
  setIndex: 1 | 2 | 3
  setsWonA: number
  setsWonB: number
  setContext: SetContext
  isDecidingSet: boolean
  canLeaderCloseMatchThisSet: boolean
}

export interface TennisPointRiskDecision {
  version: 'tennis-point-risk/v2-best-of-3'
  available: boolean
  phase: Phase
  stateLabel: string | null
  matchContext: TennisMatchContext | null
  serverContext: ServerContext | null
  baseRisk: RiskLevel | null
  contextAdjustment: number
  finalRisk: RiskLevel | null
  structuralNote: string | null
  marketBehavior: string | null
  recommendation: string | null
  machineCommand: MachineCommand | null
  stopTriggered: boolean
  matchedRule: string | null
}

type BaseDecision = {
  phase: Exclude<Phase, 'unknown'>
  stateLabel: string
  ruleKind: RuleKind
  serverContext: ServerContext
  baseRisk: RiskLevel
  structuralNote: string
  marketBehavior: string
  recommendation: string
  matchedRule: string
  hardStop?: boolean
}

type ForcedStopReason =
  | 'retired'
  | 'suspended'
  | 'interrupted'
  | 'walkover'
  | 'live_score_incomplete'

function parseNumeric(value: string | null | undefined): number | null {
  const n = Number(String(value || '').trim())
  return Number.isFinite(n) ? n : null
}

function normalizePoint(value: string | null | undefined): string {
  return String(value || '').trim().toUpperCase() || '0'
}

function normalizeStatusText(value: string | null | undefined): string {
  return String(value || '').trim().toLowerCase()
}

function riskRank(level: RiskLevel): number {
  if (level === 'low') return 1
  if (level === 'medium') return 2
  if (level === 'high') return 3
  return 4
}

function rankToRisk(rank: number): RiskLevel {
  const normalized = Math.max(1, Math.min(4, rank))
  if (normalized === 1) return 'low'
  if (normalized === 2) return 'medium'
  if (normalized === 3) return 'high'
  return 'very_high'
}

function isGamePointFor(playerPoint: string, oppPoint: string): boolean {
  if (playerPoint === 'AD') return true
  if (playerPoint === '40' && (oppPoint === '0' || oppPoint === '15' || oppPoint === '30')) return true
  return false
}

function isBreakPointAgainstServer(serverPoint: string | null, receiverPoint: string | null): boolean {
  return !!serverPoint && !!receiverPoint && isGamePointFor(receiverPoint, serverPoint)
}

function isGenericGamePoint(pointA: string, pointB: string): boolean {
  return isGamePointFor(pointA, pointB) || isGamePointFor(pointB, pointA)
}

function isGenericHeavyPoint(pointA: string, pointB: string): boolean {
  return (pointA === '40' && (pointB === '0' || pointB === '15')) ||
    (pointB === '40' && (pointA === '0' || pointA === '15')) ||
    pointA === 'AD' ||
    pointB === 'AD'
}

function deriveBestOf3Context(match: TennisFeedMatch): TennisMatchContext {
  const rawSetIndex = Math.max(1, Math.min(3, match.sets.length || 1))
  const setIndex = rawSetIndex as 1 | 2 | 3
  const setsWonA = Number(match.teamA.score || 0)
  const setsWonB = Number(match.teamB.score || 0)

  const isDecidingSet = setIndex === 3
  const canLeaderCloseMatchThisSet = setIndex === 2 && Math.abs(setsWonA - setsWonB) === 1
  const setContext: SetContext = isDecidingSet ? 'deciding_set' : canLeaderCloseMatchThisSet ? 'closing_set' : 'normal_set'

  return {
    matchFormat: 'best_of_3',
    setIndex,
    setsWonA,
    setsWonB,
    setContext,
    isDecidingSet,
    canLeaderCloseMatchThisSet,
  }
}

function inferLeader(setA: number, setB: number): 'teamA' | 'teamB' | null {
  if (setA === setB) return null
  return setA > setB ? 'teamA' : 'teamB'
}

function inferServerContext(
  leader: 'teamA' | 'teamB' | null,
  serverSide: 'teamA' | 'teamB' | null,
): ServerContext {
  if (!leader || !serverSide) return 'any'
  return leader === serverSide ? 'leader_serving' : 'trailer_serving'
}

function resolvedServerSideForRules(match: TennisFeedMatch): 'teamA' | 'teamB' | null {
  return match.serverSideResolved ?? match.serverSide
}

function forcedStopReasonForMatch(match: TennisFeedMatch): ForcedStopReason | null {
  const statusText = normalizeStatusText(match.statusText)
  if (/\bwalkover\b|\bw\/o\b/.test(statusText)) return 'walkover'
  if (/\bret(?:ired)?\b/.test(statusText)) return 'retired'
  if (/\binterrupt(?:ed|ion)?\b/.test(statusText)) return 'interrupted'
  if (/\bsuspend(?:ed)?\b|\babandon(?:ed)?\b/.test(statusText)) return 'suspended'
  if (match.status === 'LIVE' && (!match.currentSet || !match.currentGame)) return 'live_score_incomplete'
  return null
}

function forcedStopDecision(reason: ForcedStopReason): TennisPointRiskDecision {
  const rule =
    reason === 'live_score_incomplete'
      ? 'live score incomplete'
      : reason === 'walkover'
        ? 'walkover'
        : reason === 'retired'
          ? 'retired'
          : reason === 'interrupted'
            ? 'interrupted'
            : 'suspended'

  return {
    version: 'tennis-point-risk/v2-best-of-3',
    available: true,
    phase: 'unknown',
    stateLabel: null,
    matchContext: null,
    serverContext: null,
    baseRisk: 'very_high',
    contextAdjustment: 0,
    finalRisk: 'very_high',
    structuralNote: reason === 'live_score_incomplete' ? 'live 数据不完整' : '异常比赛状态',
    marketBehavior: '禁用交易',
    recommendation: '停止套利',
    machineCommand: 'STOP',
    stopTriggered: true,
    matchedRule: rule,
  }
}

function evaluateBaseTiebreak(
  pointA: number,
  pointB: number,
  serverSide: 'teamA' | 'teamB' | null,
): BaseDecision {
  const stateLabel = `TB ${pointA}-${pointB}`
  const leader = inferLeader(pointA, pointB)
  const gap = Math.abs(pointA - pointB)
  const maxPoint = Math.max(pointA, pointB)
  const leaderServing = leader && serverSide ? leader === serverSide : null
  const serverContext: ServerContext =
    pointA === pointB
      ? pointA === 2
        ? 'small_point_rotation'
        : pointA === 3
          ? 'key_point_rotation'
          : 'any'
      : inferServerContext(leader, serverSide)

  if (pointA === 2 && pointB === 2) {
    return {
      phase: 'tiebreak',
      stateLabel,
      ruleKind: 'tiebreak_hot',
      serverContext,
      baseRisk: 'medium',
      structuralNote: '初期稳定',
      marketBehavior: '平滑',
      recommendation: '轻仓',
      matchedRule: 'TB 2-2',
    }
  }

  if (pointA === 3 && pointB === 3) {
    return {
      phase: 'tiebreak',
      stateLabel,
      ruleKind: 'tiebreak_hot',
      serverContext,
      baseRisk: 'high',
      structuralNote: '中段开始',
      marketBehavior: '加速波动',
      recommendation: '降仓',
      matchedRule: 'TB 3-3',
    }
  }

  if (maxPoint >= 5 && gap === 0) {
    return {
      phase: 'tiebreak',
      stateLabel,
      ruleKind: 'tiebreak_critical',
      serverContext: 'any',
      baseRisk: 'very_high',
      structuralNote: '生死点',
      marketBehavior: '剧烈跳变',
      recommendation: '停止套利',
      matchedRule: stateLabel,
      hardStop: true,
    }
  }

  if (maxPoint >= 6 && gap === 1) {
    return {
      phase: 'tiebreak',
      stateLabel,
      ruleKind: 'tiebreak_critical',
      serverContext: leaderServing == null ? 'any' : leaderServing ? 'leader_serving' : 'trailer_serving',
      baseRisk: 'very_high',
      structuralNote: leaderServing == null ? '关键分未解析发球方' : leaderServing ? 'match/set point' : '抢分点',
      marketBehavior: leaderServing == null ? '双向爆炸' : leaderServing ? '单边爆发' : '双向爆炸',
      recommendation: '停止套利',
      matchedRule:
        leaderServing == null ? `${stateLabel} unknown server` : leaderServing ? `${stateLabel} leader serving` : `${stateLabel} trailer serving`,
      hardStop: true,
    }
  }

  if (maxPoint === 5 && gap === 1) {
    return {
      phase: 'tiebreak',
      stateLabel,
      ruleKind: 'tiebreak_hot',
      serverContext: leaderServing == null ? 'any' : leaderServing ? 'leader_serving' : 'trailer_serving',
      baseRisk: 'very_high',
      structuralNote: leaderServing == null ? '关键分未解析发球方' : leaderServing ? '领先方冲线点' : '落后方抢分点',
      marketBehavior: leaderServing == null ? '双向拉扯加剧' : leaderServing ? '单边爆发前夜' : '双向拉扯加剧',
      recommendation: '暂停',
      matchedRule:
        leaderServing == null ? `${stateLabel} unknown server` : leaderServing ? `${stateLabel} leader serving` : `${stateLabel} trailer serving`,
    }
  }

  if (maxPoint === 4 && gap === 0) {
    return {
      phase: 'tiebreak',
      stateLabel,
      ruleKind: 'tiebreak_hot',
      serverContext: 'any',
      baseRisk: 'high',
      structuralNote: '再平衡点',
      marketBehavior: '明显波动',
      recommendation: '暂停',
      matchedRule: 'TB 4-4',
    }
  }

  if (maxPoint === 4 && gap === 1) {
    return {
      phase: 'tiebreak',
      stateLabel,
      ruleKind: 'tiebreak_hot',
      serverContext: leaderServing == null ? 'any' : leaderServing ? 'leader_serving' : 'trailer_serving',
      baseRisk: 'high',
      structuralNote: leaderServing == null ? '发球方未解析' : leaderServing ? '领先方压制点' : '落后方反抽点',
      marketBehavior: leaderServing == null ? '双向摆动' : leaderServing ? '单边放大' : '双向摆动',
      recommendation: '暂停',
      matchedRule:
        leaderServing == null ? `${stateLabel} unknown server` : leaderServing ? `${stateLabel} leader serving` : `${stateLabel} trailer serving`,
    }
  }

  if (maxPoint === 3 && gap === 1) {
    return {
      phase: 'tiebreak',
      stateLabel,
      ruleKind: 'tiebreak_hot',
      serverContext: leaderServing == null ? 'any' : leaderServing ? 'leader_serving' : 'trailer_serving',
      baseRisk: leaderServing === true ? 'medium' : 'high',
      structuralNote: leaderServing == null ? '发球方未解析' : leaderServing ? '单边倾向形成' : '双向拉扯开始',
      marketBehavior: leaderServing === true ? '温和放大' : '明显摆动',
      recommendation: leaderServing === true ? '轻仓' : '暂停',
      matchedRule:
        leaderServing == null ? `${stateLabel} unknown server` : leaderServing ? `${stateLabel} leader serving` : `${stateLabel} trailer serving`,
    }
  }

  let baseRisk: RiskLevel = 'medium'
  if (gap === 0 && maxPoint >= 4) {
    baseRisk = 'high'
  } else if (gap === 1 && maxPoint >= 4) {
    baseRisk = 'high'
  }

  return {
    phase: 'tiebreak',
    stateLabel,
    ruleKind: baseRisk === 'high' ? 'tiebreak_hot' : 'normal',
    serverContext,
    baseRisk,
    structuralNote: baseRisk === 'high' ? '抢七敏感区' : '抢七前段',
    marketBehavior: baseRisk === 'high' ? '波动放大' : '逐步放大',
    recommendation: baseRisk === 'high' ? '暂停' : '轻仓',
    matchedRule: 'TB fallback',
  }
}

function evaluateBaseNonTiebreak(
  setA: number,
  setB: number,
  pointA: string,
  pointB: string,
  serverSide: 'teamA' | 'teamB' | null,
): BaseDecision {
  const stateLabel = `${setA}-${setB}, ${pointA}-${pointB}`
  const leader = inferLeader(setA, setB)
  const serverContext = inferServerContext(leader, serverSide)
  const serverPoints = serverSide === 'teamA' ? pointA : serverSide === 'teamB' ? pointB : null
  const receiverPoints = serverSide === 'teamA' ? pointB : serverSide === 'teamB' ? pointA : null
  const serverHasGamePoint = !!serverPoints && !!receiverPoints && isGamePointFor(serverPoints, receiverPoints)
  const receiverHasBreakPoint = isBreakPointAgainstServer(serverPoints, receiverPoints)
  const genericGamePoint = isGenericGamePoint(pointA, pointB)
  const genericHeavyPoint = isGenericHeavyPoint(pointA, pointB)
  const setClosingWindow = Math.max(setA, setB) >= 5 && Math.abs(setA - setB) <= 1

  if (setA === 2 && setB === 2 && pointA === '15' && pointB === '15') {
    return {
      phase: 'non_tiebreak',
      stateLabel,
      ruleKind: 'normal',
      serverContext: 'any',
      baseRisk: 'low',
      structuralNote: '中盘均衡',
      marketBehavior: '平滑波动',
      recommendation: '正常套利',
      matchedRule: '2-2 15-15',
    }
  }

  if (((setA === 4 && setB === 2) || (setA === 2 && setB === 4)) && pointA === '0' && pointB === '0') {
    const leaderServing = leader != null && serverSide === leader
    return {
      phase: 'non_tiebreak',
      stateLabel,
      ruleKind: 'opening_game',
      serverContext: leaderServing ? 'leader_serving' : 'trailer_serving',
      baseRisk: leaderServing ? 'low' : 'medium',
      structuralNote: leaderServing ? '稳态扩张' : '潜在反转点',
      marketBehavior: leaderServing ? '缓慢上升' : '易波动',
      recommendation: leaderServing ? '可继续套利' : '降权',
      matchedRule: leaderServing ? '4-2 0-0 leader serving' : '4-2 0-0 trailer serving',
    }
  }

  if (((setA === 4 && setB === 3) || (setA === 3 && setB === 4)) && pointA === '30' && pointB === '30') {
    const leaderServing = leader != null && serverSide === leader
    return {
      phase: 'non_tiebreak',
      stateLabel,
      ruleKind: 'normal',
      serverContext: leaderServing ? 'leader_serving' : 'trailer_serving',
      baseRisk: leaderServing ? 'medium' : 'high',
      structuralNote: leaderServing ? '控局阶段' : '破发机会',
      marketBehavior: leaderServing ? '小跳变' : '明显跳变',
      recommendation: leaderServing ? '轻仓' : '谨慎',
      matchedRule: leaderServing ? '4-3 30-30 leader serving' : '4-3 30-30 trailer serving',
    }
  }

  if (((setA === 5 && setB === 3) || (setA === 3 && setB === 5)) && pointA === '30' && pointB === '30') {
    const leaderServing = leader != null && serverSide === leader
    return {
      phase: 'non_tiebreak',
      stateLabel,
      ruleKind: 'normal',
      serverContext: leaderServing ? 'leader_serving' : 'trailer_serving',
      baseRisk: leaderServing ? 'medium' : 'high',
      structuralNote: leaderServing ? '收盘前稳定' : '被动防守',
      marketBehavior: leaderServing ? '小波动' : '跳变加剧',
      recommendation: leaderServing ? '可控套利' : '降仓',
      matchedRule: leaderServing ? '5-3 30-30 leader serving' : '5-3 30-30 trailer serving',
    }
  }

  if (((setA === 5 && setB === 4) || (setA === 4 && setB === 5)) && pointA === '0' && pointB === '0') {
    const leaderServing = leader != null && serverSide === leader
    return {
      phase: 'non_tiebreak',
      stateLabel,
      ruleKind: leaderServing ? 'normal' : 'set_point',
      serverContext: leaderServing ? 'leader_serving' : 'trailer_serving',
      baseRisk: leaderServing ? 'high' : 'very_high',
      structuralNote: leaderServing ? '发球胜盘局' : '破发 or 结束',
      marketBehavior: leaderServing ? '单边走势' : '双向剧烈波动',
      recommendation: leaderServing ? '暂停主动' : '停止套利',
      matchedRule: leaderServing ? '5-4 0-0 leader serving' : '5-4 0-0 trailer serving',
      hardStop: !leaderServing,
    }
  }

  if (setClosingWindow && leader && serverSide === leader && receiverHasBreakPoint) {
    return {
      phase: 'non_tiebreak',
      stateLabel,
      ruleKind: 'set_point',
      serverContext: 'receiver_set_point',
      baseRisk: 'very_high',
      structuralNote: 'set point（接发方）',
      marketBehavior: '最大跳变',
      recommendation: '暂停',
      matchedRule: 'receiver set point',
    }
  }

  if (setClosingWindow && leader && serverSide === leader && serverHasGamePoint) {
    return {
      phase: 'non_tiebreak',
      stateLabel,
      ruleKind: 'set_point',
      serverContext: 'server_set_point',
      baseRisk: 'very_high',
      structuralNote: 'set point（发球方）',
      marketBehavior: '单边跳变',
      recommendation: '暂停',
      matchedRule: 'server set point',
    }
  }

  if (setClosingWindow && !serverSide && genericGamePoint) {
    return {
      phase: 'non_tiebreak',
      stateLabel,
      ruleKind: 'set_point',
      serverContext: 'any',
      baseRisk: genericHeavyPoint ? 'very_high' : 'high',
      structuralNote: '盘末局点压力',
      marketBehavior: genericHeavyPoint ? '快速跳变' : '明显跳变',
      recommendation: '暂停',
      matchedRule: 'generic set-ending pressure',
    }
  }

  let baseRisk: RiskLevel = isLateSetWindow(setA, setB) ? 'medium' : 'low'

  if (pointA === '30' && pointB === '30') {
    baseRisk = rankToRisk(riskRank(baseRisk) + 1)
  }
  if (pointA === '40' && pointB === '40') {
    baseRisk = rankToRisk(riskRank(baseRisk) + 1)
  }
  if (pointA === 'AD' || pointB === 'AD') {
    baseRisk = rankToRisk(riskRank(baseRisk) + 1)
  }
  if (serverHasGamePoint) {
    baseRisk = rankToRisk(riskRank(baseRisk) + 1)
  }
  if (!serverSide && genericGamePoint) {
    baseRisk = rankToRisk(Math.max(riskRank(baseRisk), riskRank('medium')))
  }
  if (!serverSide && genericHeavyPoint) {
    baseRisk = rankToRisk(Math.max(riskRank(baseRisk), riskRank('high')))
  }
  if (receiverHasBreakPoint) {
    baseRisk = 'high'
  }
  if (setClosingWindow && (serverHasGamePoint || receiverHasBreakPoint || pointA === 'AD' || pointB === 'AD')) {
    baseRisk = 'very_high'
  }

  if (receiverHasBreakPoint) {
    return {
      phase: 'non_tiebreak',
      stateLabel,
      ruleKind: 'break_pressure',
      serverContext,
      baseRisk,
      structuralNote: serverContext === 'trailer_serving' ? '被动防守' : '破发压力点',
      marketBehavior: baseRisk === 'very_high' ? '快速跳变' : '明显跳变',
      recommendation: baseRisk === 'very_high' ? '暂停' : '谨慎',
      matchedRule: 'break point pressure',
    }
  }

  if (!serverSide && genericGamePoint) {
    return {
      phase: 'non_tiebreak',
      stateLabel,
      ruleKind: genericHeavyPoint ? 'break_pressure' : 'normal',
      serverContext: 'any',
      baseRisk,
      structuralNote: genericHeavyPoint ? '局点压力' : '临近局点',
      marketBehavior: genericHeavyPoint ? '明显跳变' : '轻度波动',
      recommendation: genericHeavyPoint ? '谨慎' : '轻仓',
      matchedRule: 'generic game point pressure',
    }
  }

  return {
    phase: 'non_tiebreak',
    stateLabel,
    ruleKind: 'normal',
    serverContext,
    baseRisk,
    structuralNote:
      baseRisk === 'high'
        ? '局内拉扯'
        : baseRisk === 'medium'
          ? '温和博弈'
          : '中盘平稳',
    marketBehavior:
      baseRisk === 'high'
        ? '明显波动'
        : baseRisk === 'medium'
          ? '轻度波动'
          : '平滑波动',
    recommendation: baseRisk === 'high' ? '谨慎' : baseRisk === 'medium' ? '轻仓' : '正常套利',
    matchedRule: 'fallback',
  }
}

function evaluateBaseRisk(match: TennisFeedMatch): BaseDecision | null {
  if (!match.currentSet || !match.currentGame) return null

  const setA = parseNumeric(match.currentSet.teamAScore)
  const setB = parseNumeric(match.currentSet.teamBScore)
  if (setA == null || setB == null) return null

  const pointA = normalizePoint(match.currentGame.teamAScore)
  const pointB = normalizePoint(match.currentGame.teamBScore)
  const resolvedServerSide = resolvedServerSideForRules(match)
  const isTiebreak =
    /tiebreak/i.test(String(match.currentSet.label || '')) &&
    parseNumeric(pointA) != null &&
    parseNumeric(pointB) != null

  if (isTiebreak) {
    return evaluateBaseTiebreak(Number(pointA), Number(pointB), resolvedServerSide)
  }

  return evaluateBaseNonTiebreak(setA, setB, pointA, pointB, resolvedServerSide)
}

function getCurrentSetScore(match: TennisFeedMatch): { setA: number; setB: number } | null {
  if (!match.currentSet) return null

  const setA = parseNumeric(match.currentSet.teamAScore)
  const setB = parseNumeric(match.currentSet.teamBScore)
  if (setA == null || setB == null) return null

  return { setA, setB }
}

function getCurrentGamePoints(match: TennisFeedMatch): { pointA: string; pointB: string } | null {
  if (!match.currentGame) return null

  return {
    pointA: normalizePoint(match.currentGame.teamAScore),
    pointB: normalizePoint(match.currentGame.teamBScore),
  }
}

function leaderSideFromSets(matchContext: TennisMatchContext): 'teamA' | 'teamB' | null {
  if (matchContext.setsWonA === matchContext.setsWonB) return null
  return matchContext.setsWonA > matchContext.setsWonB ? 'teamA' : 'teamB'
}

function isKeyPoint(pointA: string, pointB: string): boolean {
  return (
    (pointA === '30' && pointB === '30') ||
    (pointA === '40' && pointB === '40') ||
    pointA === 'AD' ||
    pointB === 'AD' ||
    (pointA === '40' && pointB === '30') ||
    (pointA === '30' && pointB === '40')
  )
}

function isLateSetWindow(setA: number, setB: number): boolean {
  const maxGames = Math.max(setA, setB)
  const minGames = Math.min(setA, setB)
  return maxGames >= 5 || (maxGames >= 4 && minGames >= 3)
}

function isSecondSetReversal(match: TennisFeedMatch, matchContext: TennisMatchContext): boolean {
  if (!matchContext.canLeaderCloseMatchThisSet) return false

  const leaderSide = leaderSideFromSets(matchContext)
  const currentSetScore = getCurrentSetScore(match)
  if (!leaderSide || !currentSetScore) return false

  const leaderGames = leaderSide === 'teamA' ? currentSetScore.setA : currentSetScore.setB
  const trailerGames = leaderSide === 'teamA' ? currentSetScore.setB : currentSetScore.setA

  return trailerGames >= 4 && trailerGames - leaderGames >= 2
}

function applyBestOf3Adjustment(
  match: TennisFeedMatch,
  baseRisk: RiskLevel,
  matchContext: TennisMatchContext,
  ruleKind: RuleKind,
): number {
  const currentSetScore = getCurrentSetScore(match)
  const currentGamePoints = getCurrentGamePoints(match)
  const lateSetWindow = currentSetScore ? isLateSetWindow(currentSetScore.setA, currentSetScore.setB) : false
  const keyPoint = currentGamePoints ? isKeyPoint(currentGamePoints.pointA, currentGamePoints.pointB) : false
  const hotTiebreak = ruleKind === 'tiebreak_hot' || ruleKind === 'tiebreak_critical'
  const eligibleForContext =
    riskRank(baseRisk) >= riskRank('medium') || keyPoint || lateSetWindow || hotTiebreak

  if (!eligibleForContext) {
    return 0
  }

  if (matchContext.canLeaderCloseMatchThisSet && isSecondSetReversal(match, matchContext)) {
    return 0
  }

  if (matchContext.canLeaderCloseMatchThisSet || matchContext.isDecidingSet) {
    return 1
  }

  return 0
}

function applyServeSyncAdjustment(
  match: TennisFeedMatch,
  baseRisk: RiskLevel,
  ruleKind: RuleKind,
): number {
  const usingRawFallback = match.serverSideResolved == null && match.serverSide != null
  if (!usingRawFallback) return 0

  const currentSetScore = getCurrentSetScore(match)
  const currentGamePoints = getCurrentGamePoints(match)
  const lateSetWindow = currentSetScore ? isLateSetWindow(currentSetScore.setA, currentSetScore.setB) : false
  const keyPoint = currentGamePoints ? isKeyPoint(currentGamePoints.pointA, currentGamePoints.pointB) : false
  const hotPhase = ruleKind === 'break_pressure' || ruleKind === 'set_point' || ruleKind === 'tiebreak_hot' || ruleKind === 'tiebreak_critical'

  if (hotPhase || keyPoint || lateSetWindow || riskRank(baseRisk) >= riskRank('medium')) {
    return 1
  }

  return 0
}

function toMachineCommand(
  finalRisk: RiskLevel,
  phase: Exclude<Phase, 'unknown'>,
  hardStop: boolean,
): MachineCommand {
  if (hardStop) {
    return 'STOP'
  }

  if (finalRisk === 'very_high') return 'PAUSE'
  if (finalRisk === 'high') return 'PAUSE'
  if (finalRisk === 'medium') return 'WARN'
  return 'RUN'
}

function unavailableDecision(): TennisPointRiskDecision {
  return {
    version: 'tennis-point-risk/v2-best-of-3',
    available: false,
    phase: 'unknown',
    stateLabel: null,
    matchContext: null,
    serverContext: null,
    baseRisk: null,
    contextAdjustment: 0,
    finalRisk: null,
    structuralNote: null,
    marketBehavior: null,
    recommendation: null,
    machineCommand: null,
    stopTriggered: false,
    matchedRule: null,
  }
}

export function evaluateTennisPointRisk(match: TennisFeedMatch | null): TennisPointRiskDecision {
  if (!match) return unavailableDecision()
  const forcedStopReason = forcedStopReasonForMatch(match)
  if (forcedStopReason) return forcedStopDecision(forcedStopReason)

  const base = evaluateBaseRisk(match)
  if (!base) return unavailableDecision()

  const matchContext = deriveBestOf3Context(match)
  const serveSyncAdjustment = applyServeSyncAdjustment(match, base.baseRisk, base.ruleKind)
  const contextAdjustment = applyBestOf3Adjustment(match, base.baseRisk, matchContext, base.ruleKind)
  const finalRisk = rankToRisk(riskRank(base.baseRisk) + serveSyncAdjustment + contextAdjustment)
  const stopTriggered = !!base.hardStop
  const machineCommand = toMachineCommand(finalRisk, base.phase, stopTriggered)

  return {
    version: 'tennis-point-risk/v2-best-of-3',
    available: true,
    phase: base.phase,
    stateLabel: base.stateLabel,
    matchContext,
    serverContext: base.serverContext,
    baseRisk: base.baseRisk,
    contextAdjustment: serveSyncAdjustment + contextAdjustment,
    finalRisk,
    structuralNote: base.structuralNote,
    marketBehavior: base.marketBehavior,
    recommendation: base.recommendation,
    machineCommand,
    stopTriggered,
    matchedRule: base.matchedRule,
  }
}
