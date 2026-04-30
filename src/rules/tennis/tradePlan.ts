import type { TennisFeedMatch } from '../../realtime-score/tennis/types.js'
import type { TennisPointRiskDecision } from './pointRiskEngine.js'

export type TradeMode =
  | 'watch'
  | 'maker_reversion_light'
  | 'maker_reversion_minimal'
  | 'pause_only'
  | 'hard_stop'

export type ExposureTier = 'none' | 'small' | 'minimal'
export type PreferredSide = 'none' | 'extreme_low_price_side'
export type ExitMode = 'none' | 'price_recovery' | 'force_exit'

export interface TennisTradePlan {
  available: boolean
  jumpPhase: boolean
  tradeMode: TradeMode
  makerOnly: boolean
  exposureAllowed: boolean
  maxExposureTier: ExposureTier
  preferredSide: PreferredSide
  exitMode: ExitMode
  forceExitOnStop: boolean
  maxHoldSeconds: number | null
  summary: string
  rationale: string[]
}

const HOT_PAUSE_RULES = new Set([
  'receiver set point',
  'server set point',
  'TB 4-4',
  'TB 5-4 leader serving',
  'TB 5-4 trailer serving',
  'TB 4-5 leader serving',
  'TB 4-5 trailer serving',
])

function isJumpPhase(pointRisk: TennisPointRiskDecision): boolean {
  if (!pointRisk.available) return false
  if (pointRisk.phase === 'tiebreak') return true
  if (!pointRisk.stateLabel) return false
  return pointRisk.machineCommand === 'WARN' || pointRisk.machineCommand === 'PAUSE' || pointRisk.machineCommand === 'STOP'
}

function isHotPause(pointRisk: TennisPointRiskDecision): boolean {
  if (!pointRisk.available || pointRisk.machineCommand !== 'PAUSE') return false
  if (pointRisk.matchedRule && HOT_PAUSE_RULES.has(pointRisk.matchedRule)) return true
  return pointRisk.phase === 'tiebreak' && pointRisk.finalRisk === 'very_high'
}

function summaryFor(mode: TradeMode): string {
  if (mode === 'watch') return '非跳变期，仅观察。'
  if (mode === 'maker_reversion_light') return '跳变期轻仓 maker，优先抓低价一侧回补。'
  if (mode === 'maker_reversion_minimal') return '高敏跳变期，仅允许极小仓位 maker 快进快出。'
  if (mode === 'pause_only') return '跳变热点区，不建议新开仓，只管理已有仓位。'
  return '硬停区，不允许带敞口，必要时强制退出。'
}

export function deriveTennisTradePlan(
  match: TennisFeedMatch | null,
  pointRisk: TennisPointRiskDecision,
): TennisTradePlan {
  if (!match || !pointRisk.available || !pointRisk.machineCommand) {
    return {
      available: false,
      jumpPhase: false,
      tradeMode: 'watch',
      makerOnly: false,
      exposureAllowed: false,
      maxExposureTier: 'none',
      preferredSide: 'none',
      exitMode: 'none',
      forceExitOnStop: false,
      maxHoldSeconds: null,
      summary: '暂无可交易计划。',
      rationale: ['missing_match_context'],
    }
  }

  const jumpPhase = isJumpPhase(pointRisk)

  if (pointRisk.stopTriggered || pointRisk.machineCommand === 'STOP') {
    return {
      available: true,
      jumpPhase,
      tradeMode: 'hard_stop',
      makerOnly: false,
      exposureAllowed: false,
      maxExposureTier: 'none',
      preferredSide: 'none',
      exitMode: 'force_exit',
      forceExitOnStop: true,
      maxHoldSeconds: 0,
      summary: summaryFor('hard_stop'),
      rationale: [pointRisk.matchedRule || 'hard_stop', 'jump_phase', 'no_new_exposure'],
    }
  }

  if (isHotPause(pointRisk)) {
    return {
      available: true,
      jumpPhase,
      tradeMode: 'pause_only',
      makerOnly: true,
      exposureAllowed: false,
      maxExposureTier: 'none',
      preferredSide: 'extreme_low_price_side',
      exitMode: 'price_recovery',
      forceExitOnStop: true,
      maxHoldSeconds: 15,
      summary: summaryFor('pause_only'),
      rationale: [pointRisk.matchedRule || 'hot_pause', 'jump_phase', 'manage_existing_only'],
    }
  }

  if (pointRisk.machineCommand === 'PAUSE') {
    return {
      available: true,
      jumpPhase,
      tradeMode: 'maker_reversion_minimal',
      makerOnly: true,
      exposureAllowed: true,
      maxExposureTier: 'minimal',
      preferredSide: 'extreme_low_price_side',
      exitMode: 'price_recovery',
      forceExitOnStop: true,
      maxHoldSeconds: 20,
      summary: summaryFor('maker_reversion_minimal'),
      rationale: [pointRisk.matchedRule || 'pause', 'jump_phase', 'minimal_exposure_only'],
    }
  }

  if (pointRisk.machineCommand === 'WARN') {
    return {
      available: true,
      jumpPhase,
      tradeMode: 'maker_reversion_light',
      makerOnly: true,
      exposureAllowed: true,
      maxExposureTier: 'small',
      preferredSide: 'extreme_low_price_side',
      exitMode: 'price_recovery',
      forceExitOnStop: true,
      maxHoldSeconds: 30,
      summary: summaryFor('maker_reversion_light'),
      rationale: [pointRisk.matchedRule || 'warn', 'jump_phase', 'light_maker_reversion'],
    }
  }

  return {
    available: true,
    jumpPhase,
    tradeMode: 'watch',
    makerOnly: false,
    exposureAllowed: false,
    maxExposureTier: 'none',
    preferredSide: 'none',
    exitMode: 'none',
    forceExitOnStop: false,
    maxHoldSeconds: null,
    summary: summaryFor('watch'),
    rationale: [pointRisk.matchedRule || 'run', 'no_jump_phase_trade'],
  }
}
