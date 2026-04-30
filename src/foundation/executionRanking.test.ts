import { describe, expect, it, vi } from 'vitest'

import { buildExecutionRankingReport, scoreExecutionRow } from './executionRanking.js'

vi.mock('./labeledExecutionDataset.js', () => ({
  buildLabeledExecutionDataset: vi.fn(),
}))

import { buildLabeledExecutionDataset } from './labeledExecutionDataset.js'

describe('execution ranking', () => {
  it('scores rows using actionability, edge, and execution labels', () => {
    const row = scoreExecutionRow({
      capturedAt: '2026-04-29T10:00:00.000Z',
      matchId: 'm1',
      flashscoreMatchUrl: 'https://flashscore.test/m1',
      provider: 'polymarket',
      providerUrl: 'https://poly.test/m1',
      teamA: 'A',
      teamB: 'B',
      tourType: 'ATP',
      qualityTier: 'high',
      setupType: 'cross_market_teamA',
      legRole: 'cheap_leg',
      actionability: 'direct_candidate',
      side: 'teamA',
      marketEligible: true,
      liveDecisionAction: 'candidate',
      blockedBy: [],
      pFairSide: 0.72,
      pFairOtherSide: 0.28,
      marketBidSide: 0.6,
      marketAskSide: 0.61,
      marketMidSide: 0.605,
      marketLastSide: 0.61,
      edgeVsBidSide: 0.12,
      edgeVsAskSide: 0.11,
      edgeVsMidSide: 0.115,
      edgeVsLastSide: 0.11,
      spreadSide: 0.01,
      crossSpreadSameSide: 0.09,
      quoteHypotheses: {
        passivePrice: 0.6,
        aggressivePrice: 0.61,
        passiveTouchLabel: null,
        fillBeforeMoveLabel: null,
      },
      executionLabels: {
        futureCaptureCount: 3,
        horizonSeconds: 240,
        passiveTouch: true,
        passiveTouchAtSeconds: 120,
        adverseMoveBeforePassive: false,
        adverseMoveAtSeconds: null,
        passiveFillBeforeAdverse: true,
        minFutureAskSide: 0.6,
        maxFutureBidSide: 0.59,
        minFutureLastSide: 0.6,
        maxFutureLastSide: 0.63,
        maxPriceImprovementVsLast: 0.01,
        maxPriceDeteriorationVsLast: 0.02,
      },
    } as never)

    expect(row.researchScore).toBeGreaterThan(0)
    expect(row.executionScore).toBeGreaterThan(0)
    expect(row.executionEligible).toBe(true)
    expect(row.scoreBreakdown.passiveFillBeforeAdverse).toBeGreaterThan(0)
  })

  it('sorts higher-quality direct opportunities above weaker rows', async () => {
    vi.mocked(buildLabeledExecutionDataset).mockResolvedValue({
      version: 'labeled-execution-dataset/v1',
      generatedAt: '2026-04-29T00:00:00.000Z',
      comparisonCount: 2,
      rowCount: 2,
      labeledRowCount: 2,
      rows: [
        {
          capturedAt: '2026-04-29T10:00:00.000Z',
          matchId: 'm1',
          flashscoreMatchUrl: 'https://flashscore.test/m1',
          provider: 'polymarket',
          providerUrl: 'https://poly.test/m1',
          teamA: 'A',
          teamB: 'B',
          tourType: 'ATP',
          qualityTier: 'high',
          setupType: 'cross_market_teamA',
          legRole: 'cheap_leg',
          actionability: 'direct_candidate',
          side: 'teamA',
          marketEligible: true,
          liveDecisionAction: 'candidate',
          blockedBy: [],
          pFairSide: 0.72,
          pFairOtherSide: 0.28,
          marketBidSide: 0.6,
          marketAskSide: 0.61,
          marketMidSide: 0.605,
          marketLastSide: 0.61,
          edgeVsBidSide: 0.12,
          edgeVsAskSide: 0.11,
          edgeVsMidSide: 0.115,
          edgeVsLastSide: 0.11,
          spreadSide: 0.01,
          crossSpreadSameSide: 0.09,
          quoteHypotheses: { passivePrice: 0.6, aggressivePrice: 0.61, passiveTouchLabel: null, fillBeforeMoveLabel: null },
          executionLabels: {
            futureCaptureCount: 3,
            horizonSeconds: 240,
            passiveTouch: true,
            passiveTouchAtSeconds: 120,
            adverseMoveBeforePassive: false,
            adverseMoveAtSeconds: null,
            passiveFillBeforeAdverse: true,
            minFutureAskSide: 0.6,
            maxFutureBidSide: 0.59,
            minFutureLastSide: 0.6,
            maxFutureLastSide: 0.63,
            maxPriceImprovementVsLast: 0.01,
            maxPriceDeteriorationVsLast: 0.02,
          },
        },
        {
          capturedAt: '2026-04-29T10:01:00.000Z',
          matchId: 'm2',
          flashscoreMatchUrl: 'https://flashscore.test/m2',
          provider: 'kalshi',
          providerUrl: 'https://kalshi.test/m2',
          teamA: 'A',
          teamB: 'B',
          tourType: 'ATP',
          qualityTier: 'low',
          setupType: 'watch_only_dislocation',
          legRole: 'watch_only',
          actionability: 'watch_only',
          side: 'teamA',
          marketEligible: true,
          liveDecisionAction: 'watch_only',
          blockedBy: [],
          pFairSide: 0.36,
          pFairOtherSide: 0.64,
          marketBidSide: null,
          marketAskSide: 0.75,
          marketMidSide: null,
          marketLastSide: 0.73,
          edgeVsBidSide: null,
          edgeVsAskSide: -0.39,
          edgeVsMidSide: null,
          edgeVsLastSide: -0.37,
          spreadSide: null,
          crossSpreadSameSide: null,
          quoteHypotheses: { passivePrice: null, aggressivePrice: 0.75, passiveTouchLabel: null, fillBeforeMoveLabel: null },
          executionLabels: {
            futureCaptureCount: 1,
            horizonSeconds: 60,
            passiveTouch: false,
            passiveTouchAtSeconds: null,
            adverseMoveBeforePassive: false,
            adverseMoveAtSeconds: null,
            passiveFillBeforeAdverse: false,
            minFutureAskSide: 0.77,
            maxFutureBidSide: null,
            minFutureLastSide: 0.76,
            maxFutureLastSide: 0.76,
            maxPriceImprovementVsLast: -0.03,
            maxPriceDeteriorationVsLast: 0.03,
          },
        },
      ] as never,
    })

    const report = await buildExecutionRankingReport('multi-market-comparisons')
    expect(report.topRows[0]?.provider).toBe('polymarket')
    expect(report.topRows[0]?.executionEligible).toBe(true)
    expect(report.topRows[1]?.executionEligible).toBe(false)
    expect(report.topRows[0]?.executionScore).toBeGreaterThan(report.topRows[1]?.executionScore ?? 0)
  })
})
