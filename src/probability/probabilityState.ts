import type { CanonicalMatchState } from '../foundation/canonicalMatchState.js'
import { inferStrengthBucket, type PrematchBaseline } from '../foundation/prematchBaseline.js'
import type { ResolvedStats } from '../foundation/resolvedStats.js'
import { buildPFairState } from '../pfair/engine.js'
import type { PFairState } from '../pfair/types.js'
import type { TennisPointRiskDecision } from '../rules/tennis/pointRiskEngine.js'

export interface TennisProbabilityState {
  version: 'tennis-probability-state/v1'
  available: boolean
  baseline: PrematchBaseline
  pFair: PFairState
  risk: {
    level: TennisPointRiskDecision['finalRisk']
    machineCommand: TennisPointRiskDecision['machineCommand']
    matchedRule: string | null
    riskDrivers: string[]
  }
  context: {
    phase: TennisPointRiskDecision['phase']
    setContext: TennisPointRiskDecision['matchContext']['setContext'] | null
    isTiebreak: boolean
    isDecidingSet: boolean
    abnormalReason: CanonicalMatchState['status']['abnormalReason'] | null
    matchIntegrity: CanonicalMatchState['quality']['matchIntegrity'] | null
  }
}

export function buildDefaultPrematchBaseline(state: CanonicalMatchState | null): PrematchBaseline {
  return {
    source: 'none',
    complete: false,
    bestOf: state?.competition.bestOf ?? null,
    surface: 'unknown',
    tourType: state?.competition.tourType ?? 'UNKNOWN',
    prematchFairProbA: null,
    prematchFairProbB: null,
    strengthBucketA: inferStrengthBucket(null),
    strengthBucketB: inferStrengthBucket(null),
    pointBaselineA: null,
    pointBaselineB: null,
    holdBaselineA: null,
    holdBaselineB: null,
    breakBaselineA: null,
    breakBaselineB: null,
  }
}

function buildRiskDrivers(state: CanonicalMatchState | null, decision: TennisPointRiskDecision): string[] {
  const drivers: string[] = []

  if (state?.scoreboard.isTiebreak) drivers.push('tiebreak')
  if (decision.matchContext?.setContext === 'closing_set') drivers.push('closing_set')
  if (decision.matchContext?.setContext === 'deciding_set') drivers.push('deciding_set')
  if (decision.serverContext && decision.serverContext !== 'any') drivers.push(`server:${decision.serverContext}`)
  if (decision.matchedRule) drivers.push(`rule:${decision.matchedRule}`)
  if (decision.stopTriggered) drivers.push('hard_stop')
  if (state?.quality.matchIntegrity && state.quality.matchIntegrity !== 'ok') {
    drivers.push(`integrity:${state.quality.matchIntegrity}`)
  }

  return drivers
}

export function buildProbabilityState(input: {
  state: CanonicalMatchState | null
  pointRisk: TennisPointRiskDecision
  baseline?: PrematchBaseline | null
  resolvedStats?: ResolvedStats | null
}): TennisProbabilityState {
  const state = input.state
  const baseline = input.baseline ?? buildDefaultPrematchBaseline(state)
  const pFair = buildPFairState({
    state,
    baseline,
    pointRisk: input.pointRisk,
    resolvedStats: input.resolvedStats,
  })

  return {
    version: 'tennis-probability-state/v1',
    available: !!state && input.pointRisk.available,
    baseline,
    pFair,
    risk: {
      level: input.pointRisk.finalRisk,
      machineCommand: input.pointRisk.machineCommand,
      matchedRule: input.pointRisk.matchedRule,
      riskDrivers: buildRiskDrivers(state, input.pointRisk),
    },
    context: {
      phase: input.pointRisk.phase,
      setContext: input.pointRisk.matchContext?.setContext ?? null,
      isTiebreak: state?.scoreboard.isTiebreak ?? false,
      isDecidingSet: input.pointRisk.matchContext?.isDecidingSet ?? false,
      abnormalReason: state?.status.abnormalReason ?? null,
      matchIntegrity: state?.quality.matchIntegrity ?? null,
    },
  }
}
