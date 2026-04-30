import { describe, expect, it, vi } from 'vitest'

vi.mock('./portfolioRiskBudget.js', () => ({
  buildPortfolioRiskBudget: vi.fn(),
}))

vi.mock('./resolvedOutcome.js', () => ({
  loadResolvedOutcomeIndex: vi.fn(),
  findResolvedOutcome: vi.fn(),
}))

import { buildPortfolioRiskBudget } from './portfolioRiskBudget.js'
import { buildPortfolioAudit } from './portfolioAudit.js'
import { findResolvedOutcome, loadResolvedOutcomeIndex } from './resolvedOutcome.js'

describe('buildPortfolioAudit', () => {
  it('audits allocated positions against resolved outcomes', async () => {
    vi.mocked(buildPortfolioRiskBudget).mockResolvedValue({
      version: 'portfolio-risk-budget/v1',
      generatedAt: '2026-04-29T00:00:00.000Z',
      policy: {
        bankrollUsd: 100000,
        maxPortfolioFraction: 0.02,
        maxSingleIdeaFraction: 0.01,
        maxProviderFraction: 0.0125,
      },
      synthesisCount: 2,
      candidateCount: 2,
      allocatedCount: 2,
      totalRequestedFraction: 0.01,
      totalAllocatedFraction: 0.01,
      totalAllocatedUsd: 1000,
      providerAllocatedFraction: { kalshi: 0, polymarket: 0.01, unknown: 0 },
      allocations: [
        {
          capturedAt: '2026-04-29T00:00:00.000Z',
          matchId: 'm1',
          flashscoreMatchUrl: 'fs://1',
          teamA: 'A',
          teamB: 'B',
          provider: 'polymarket',
          action: 'execute',
          regimePermitted: true,
          setupType: 'cross_market_teamA',
          riskLevel: 'high',
          regimeTag: 'stable_dislocation',
          requestedFraction: 0.005,
          cappedFraction: 0.005,
          allocatedFraction: 0.005,
          allocatedUsd: 500,
          maxLossUsd: 175,
          confidenceTier: 'pilot',
          executionScore: 60,
          reasons: [],
        },
        {
          capturedAt: '2026-04-29T00:01:00.000Z',
          matchId: 'm2',
          flashscoreMatchUrl: 'fs://2',
          teamA: 'C',
          teamB: 'D',
          provider: 'polymarket',
          action: 'execute',
          regimePermitted: true,
          setupType: 'cross_market_teamB',
          riskLevel: 'high',
          regimeTag: 'stable_dislocation',
          requestedFraction: 0.005,
          cappedFraction: 0.005,
          allocatedFraction: 0.005,
          allocatedUsd: 500,
          maxLossUsd: 175,
          confidenceTier: 'pilot',
          executionScore: 55,
          reasons: [],
        },
      ],
    })

    vi.mocked(loadResolvedOutcomeIndex).mockResolvedValue(new Map())
    vi.mocked(findResolvedOutcome)
      .mockReturnValueOnce({ status: 'FINAL', winner: 'teamA' } as never)
      .mockReturnValueOnce({ status: 'FINAL', winner: 'teamA' } as never)

    const report = await buildPortfolioAudit('/tmp/x', { outcomeRootDir: '/tmp/outcomes' })

    expect(report.resolvedCount).toBe(2)
    expect(report.overall.correctDirectionCount).toBe(1)
    expect(report.overall.correctDirectionRate).toBe(0.5)
    expect(report.overall.weightedCorrectRateByUsd).toBe(0.5)
    expect(report.byProvider[0]?.key).toBe('polymarket')
  })
})
