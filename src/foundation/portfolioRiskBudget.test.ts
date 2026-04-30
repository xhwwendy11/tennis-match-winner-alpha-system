import { describe, expect, it, vi } from 'vitest'

vi.mock('./executionSynthesis.js', () => ({
  buildExecutionSynthesis: vi.fn(),
}))

import { buildExecutionSynthesis } from './executionSynthesis.js'
import { buildPortfolioRiskBudget } from './portfolioRiskBudget.js'

describe('buildPortfolioRiskBudget', () => {
  it('allocates only permitted execute rows under portfolio constraints', async () => {
    vi.mocked(buildExecutionSynthesis).mockResolvedValue({
      version: 'execution-synthesis/v1',
      generatedAt: '2026-04-29T00:00:00.000Z',
      comparisonCount: 3,
      rowCount: 3,
      actionCounts: { execute: 2, research_only: 1, ignore: 0 },
      riskCounts: { low: 0, medium: 0, high: 2, extreme: 1 },
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
            bankrollFraction: 0.01,
            maxPositionUsdPer100kBankroll: 1000,
            maxLegUsdPer100kBankroll: 500,
            maxLossUsdPer100kBankroll: 350,
            confidenceTier: 'reduced',
            reasons: [],
          },
          shortlistEligible: true,
          executionEligibleLegCount: 1,
          primaryLeg: { provider: 'polymarket', executionScore: 80 } as never,
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
          qualityTier: 'high',
          setupType: 'cross_market_teamB',
          action: 'execute',
          riskLevel: 'high',
          sizingHint: 'quarter',
          regimeTag: 'stable_dislocation',
          pathContext: {} as never,
          regimePolicy: { action: 'execute', sizingHint: 'quarter', permitted: true, reasons: [] },
          positionSizingPolicy: {
            sizingHint: 'quarter',
            bankrollFraction: 0.01,
            maxPositionUsdPer100kBankroll: 1000,
            maxLegUsdPer100kBankroll: 500,
            maxLossUsdPer100kBankroll: 350,
            confidenceTier: 'reduced',
            reasons: [],
          },
          shortlistEligible: true,
          executionEligibleLegCount: 1,
          primaryLeg: { provider: 'polymarket', executionScore: 70 } as never,
          supportingLegs: [],
          reason: '',
        },
        {
          capturedAt: '2026-04-29T00:02:00.000Z',
          matchId: 'm3',
          flashscoreMatchUrl: 'fs://3',
          teamA: 'E',
          teamB: 'F',
          tourType: 'ATP',
          qualityTier: 'low',
          setupType: 'watch_only_dislocation',
          action: 'research_only',
          riskLevel: 'extreme',
          sizingHint: 'none',
          regimeTag: 'cross_market_flip',
          pathContext: {} as never,
          regimePolicy: { action: 'ignore', sizingHint: 'none', permitted: false, reasons: [] },
          positionSizingPolicy: {
            sizingHint: 'none',
            bankrollFraction: 0,
            maxPositionUsdPer100kBankroll: 0,
            maxLegUsdPer100kBankroll: 0,
            maxLossUsdPer100kBankroll: 0,
            confidenceTier: 'none',
            reasons: [],
          },
          shortlistEligible: false,
          executionEligibleLegCount: 0,
          primaryLeg: { provider: 'kalshi', executionScore: -10 } as never,
          supportingLegs: [],
          reason: '',
        },
      ],
    })

    const report = await buildPortfolioRiskBudget('/tmp/x', {
      policy: {
        bankrollUsd: 100000,
        maxPortfolioFraction: 0.015,
        maxSingleIdeaFraction: 0.01,
        maxProviderFraction: 0.0125,
      },
    })

    expect(report.candidateCount).toBe(2)
    expect(report.allocatedCount).toBe(2)
    expect(report.totalAllocatedFraction).toBe(0.0125)
    expect(report.totalAllocatedUsd).toBe(1250)
    expect(report.providerAllocatedFraction.polymarket).toBe(0.0125)
    expect(report.allocations[0]?.allocatedUsd).toBe(1000)
    expect(report.allocations[1]?.allocatedUsd).toBe(250)
  })
})
