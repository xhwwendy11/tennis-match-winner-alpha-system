import { describe, expect, it, vi } from 'vitest'

vi.mock('./executionSynthesis.js', () => ({
  buildExecutionSynthesis: vi.fn(),
}))

vi.mock('./resolvedOutcome.js', () => ({
  loadResolvedOutcomeIndex: vi.fn(),
  findResolvedOutcome: vi.fn(),
}))

import { buildExecutionSynthesis } from './executionSynthesis.js'
import { buildResolvedExecutionAudit } from './resolvedExecutionAudit.js'
import { findResolvedOutcome, loadResolvedOutcomeIndex } from './resolvedOutcome.js'

describe('buildResolvedExecutionAudit', () => {
  it('audits resolved execution rows', async () => {
    vi.mocked(buildExecutionSynthesis).mockResolvedValue({
      version: 'execution-synthesis/v1',
      generatedAt: '2026-04-29T00:00:00.000Z',
      comparisonCount: 2,
      rowCount: 2,
      actionCounts: { execute: 1, research_only: 1, ignore: 0 },
      riskCounts: { low: 0, medium: 0, high: 1, extreme: 1 },
      rows: [
        {
          capturedAt: '2026-04-29T00:00:00.000Z',
          matchId: 'm1',
          flashscoreMatchUrl: 'fs://1',
          teamA: 'A',
          teamB: 'B',
          tourType: 'ATP',
          qualityTier: 'high',
          setupType: 'cross_market_teamA',
          action: 'execute',
          riskLevel: 'high',
          sizingHint: 'quarter',
          regimeTag: 'stable_dislocation',
          pathContext: {} as never,
          regimePolicy: { action: 'execute', sizingHint: 'quarter', permitted: true, reasons: [] },
          positionSizingPolicy: {
            sizingHint: 'quarter',
            bankrollFraction: 0.005,
            maxPositionUsdPer100kBankroll: 500,
            maxLegUsdPer100kBankroll: 250,
            maxLossUsdPer100kBankroll: 175,
            confidenceTier: 'pilot',
            reasons: [],
          },
          shortlistEligible: true,
          executionEligibleLegCount: 1,
          primaryLeg: {
            provider: 'polymarket',
            providerUrl: 'pm://1',
            side: 'teamA',
            legRole: 'cheap_leg',
            actionability: 'direct_candidate',
            marketEligible: true,
            setupType: 'cross_market_teamA',
            pFairSide: 0.7,
            marketLastSide: 0.6,
            edgeVsLastSide: 0.1,
            crossSpreadSameSide: 0.08,
            spreadSide: 0.01,
            passivePrice: 0.59,
            aggressivePrice: 0.6,
            futureCaptureCount: 1,
            passiveTouch: false,
            passiveFillBeforeAdverse: false,
            adverseMoveBeforePassive: true,
            researchScore: 30,
            executionScore: 50,
            executionEligible: true,
          },
          supportingLegs: [],
          reason: '',
        },
        {
          capturedAt: '2026-04-29T00:01:00.000Z',
          matchId: 'm2',
          flashscoreMatchUrl: 'fs://2',
          teamA: 'C',
          teamB: 'D',
          tourType: 'ATP',
          qualityTier: 'low',
          setupType: 'watch_only_dislocation',
          action: 'research_only',
          riskLevel: 'extreme',
          sizingHint: 'none',
          regimeTag: 'cross_market_flip',
          pathContext: {} as never,
          regimePolicy: { action: 'ignore', sizingHint: 'none', permitted: false, reasons: ['extreme_risk_level'] },
          positionSizingPolicy: {
            sizingHint: 'none',
            bankrollFraction: 0,
            maxPositionUsdPer100kBankroll: 0,
            maxLegUsdPer100kBankroll: 0,
            maxLossUsdPer100kBankroll: 0,
            confidenceTier: 'none',
            reasons: ['execution_not_permitted'],
          },
          shortlistEligible: false,
          executionEligibleLegCount: 0,
          primaryLeg: {
            provider: 'kalshi',
            providerUrl: 'ks://2',
            side: 'teamA',
            legRole: 'watch_only',
            actionability: 'watch_only',
            marketEligible: true,
            setupType: 'watch_only_dislocation',
            pFairSide: 0.4,
            marketLastSide: 0.7,
            edgeVsLastSide: -0.3,
            crossSpreadSameSide: null,
            spreadSide: null,
            passivePrice: null,
            aggressivePrice: 0.7,
            futureCaptureCount: 1,
            passiveTouch: false,
            passiveFillBeforeAdverse: false,
            adverseMoveBeforePassive: false,
            researchScore: 10,
            executionScore: -10,
            executionEligible: false,
          },
          supportingLegs: [],
          reason: '',
        },
      ],
    })

    const outcomeIndex = new Map()
    vi.mocked(loadResolvedOutcomeIndex).mockResolvedValue(outcomeIndex)
    vi.mocked(findResolvedOutcome)
      .mockReturnValueOnce({ status: 'FINAL', winner: 'teamA' } as never)
      .mockReturnValueOnce({ status: 'FINAL', winner: 'teamB' } as never)

    const report = await buildResolvedExecutionAudit('/tmp/x', { outcomeRootDir: '/tmp/outcomes' })

    expect(report.resolvedCount).toBe(2)
    expect(report.overall.permittedCount).toBe(1)
    expect(report.overall.permittedCorrectCount).toBe(1)
    expect(report.rows[0]?.correctDirection).toBe(true)
    expect(report.rows[0]?.bankrollFraction).toBe(0.005)
    expect(report.byPrimaryProvider[0]?.key).toBe('kalshi')
    expect(report.byPrimaryProvider[1]?.key).toBe('polymarket')
  })
})
