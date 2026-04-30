import { describe, expect, it, vi } from 'vitest'

vi.mock('./executionRanking.js', () => ({
  buildExecutionRankingReport: vi.fn(),
}))

vi.mock('./labeledExecutionDataset.js', () => ({
  buildLabeledExecutionDataset: vi.fn(),
}))

vi.mock('./recapturePathReport.js', () => ({
  buildRecapturePathReport: vi.fn(),
}))

import { buildExecutionRankingReport } from './executionRanking.js'
import { buildLabeledExecutionDataset } from './labeledExecutionDataset.js'
import { buildRecapturePathReport } from './recapturePathReport.js'
import { buildExecutionSynthesis } from './executionSynthesis.js'

describe('buildExecutionSynthesis', () => {
  it('promotes execution-eligible legs into execute rows', async () => {
    vi.mocked(buildExecutionRankingReport).mockResolvedValue({
      version: 'execution-ranking-report/v1',
      generatedAt: '2026-04-29T00:00:00.000Z',
      rowCount: 2,
      rankedCount: 2,
      topRows: [
        {
          capturedAt: '2026-04-29T00:00:00.000Z',
          matchId: 'm1',
          flashscoreMatchUrl: 'fs://1',
          provider: 'polymarket',
          providerUrl: 'pm://1',
          teamA: 'A',
          teamB: 'B',
          tourType: 'ATP_CHALLENGER',
          qualityTier: 'high',
          setupType: 'cross_market_teamA',
          legRole: 'cheap_leg',
          actionability: 'direct_candidate',
          side: 'teamA',
          marketEligible: true,
          edgeVsLastSide: 0.11,
          crossSpreadSameSide: 0.09,
          spreadSide: 0.03,
          futureCaptureCount: 3,
          passiveTouch: false,
          passiveFillBeforeAdverse: true,
          adverseMoveBeforePassive: false,
          researchScore: 38,
          executionScore: 63,
          executionEligible: true,
          scoreBreakdown: {} as never,
        },
        {
          capturedAt: '2026-04-29T00:00:00.000Z',
          matchId: 'm1',
          flashscoreMatchUrl: 'fs://1',
          provider: 'kalshi',
          providerUrl: 'ks://1',
          teamA: 'A',
          teamB: 'B',
          tourType: 'ATP_CHALLENGER',
          qualityTier: 'high',
          setupType: 'cross_market_teamA',
          legRole: 'rich_leg',
          actionability: 'direct_candidate',
          side: 'teamA',
          marketEligible: false,
          edgeVsLastSide: 0.02,
          crossSpreadSameSide: 0.09,
          spreadSide: 0.04,
          futureCaptureCount: 3,
          passiveTouch: false,
          passiveFillBeforeAdverse: false,
          adverseMoveBeforePassive: false,
          researchScore: 20,
          executionScore: 35,
          executionEligible: false,
          scoreBreakdown: {} as never,
        },
      ],
      byProviderTop: {
        kalshi: [],
        polymarket: [],
      },
    })

    vi.mocked(buildLabeledExecutionDataset).mockResolvedValue({
      version: 'labeled-execution-dataset/v1',
      generatedAt: '2026-04-29T00:00:00.000Z',
      comparisonCount: 1,
      rowCount: 2,
      labeledRowCount: 2,
      rows: [
        {
          version: 'execution-dataset-row/v1',
          capturedAt: '2026-04-29T00:00:00.000Z',
          matchId: 'm1',
          flashscoreMatchUrl: 'fs://1',
          teamA: 'A',
          teamB: 'B',
          tourType: 'ATP_CHALLENGER',
          qualityTier: 'high',
          provider: 'polymarket',
          providerUrl: 'pm://1',
          setupType: 'cross_market_teamA',
          setupReason: '',
          legRole: 'cheap_leg',
          actionability: 'direct_candidate',
          side: 'teamA',
          marketEligible: true,
          liveDecisionAction: 'candidate',
          blockedBy: [],
          pFairSide: 0.72,
          pFairOtherSide: 0.28,
          marketBidSide: 0.58,
          marketAskSide: 0.61,
          marketMidSide: 0.595,
          marketLastSide: 0.61,
          edgeVsBidSide: 0.14,
          edgeVsAskSide: 0.11,
          edgeVsMidSide: 0.125,
          edgeVsLastSide: 0.11,
          spreadSide: 0.03,
          crossSpreadSameSide: 0.09,
          quoteHypotheses: {
            passivePrice: 0.58,
            aggressivePrice: 0.61,
            passiveTouchLabel: null,
            fillBeforeMoveLabel: null,
          },
          executionLabels: {
            futureCaptureCount: 3,
            horizonSeconds: 120,
            passiveTouch: false,
            passiveTouchAtSeconds: null,
            adverseMoveBeforePassive: false,
            adverseMoveAtSeconds: null,
            passiveFillBeforeAdverse: true,
            minFutureAskSide: 0.57,
            maxFutureBidSide: 0.56,
            minFutureLastSide: 0.6,
            maxFutureLastSide: 0.72,
            maxPriceImprovementVsLast: 0.11,
            maxPriceDeteriorationVsLast: 0,
          },
        },
        {
          version: 'execution-dataset-row/v1',
          capturedAt: '2026-04-29T00:00:00.000Z',
          matchId: 'm1',
          flashscoreMatchUrl: 'fs://1',
          teamA: 'A',
          teamB: 'B',
          tourType: 'ATP_CHALLENGER',
          qualityTier: 'high',
          provider: 'kalshi',
          providerUrl: 'ks://1',
          setupType: 'cross_market_teamA',
          setupReason: '',
          legRole: 'rich_leg',
          actionability: 'direct_candidate',
          side: 'teamA',
          marketEligible: false,
          liveDecisionAction: 'candidate_but_ineligible',
          blockedBy: ['low_volume'],
          pFairSide: 0.72,
          pFairOtherSide: 0.28,
          marketBidSide: 0.68,
          marketAskSide: 0.7,
          marketMidSide: 0.69,
          marketLastSide: 0.7,
          edgeVsBidSide: 0.04,
          edgeVsAskSide: 0.02,
          edgeVsMidSide: 0.03,
          edgeVsLastSide: 0.02,
          spreadSide: 0.02,
          crossSpreadSameSide: 0.09,
          quoteHypotheses: {
            passivePrice: 0.68,
            aggressivePrice: 0.7,
            passiveTouchLabel: null,
            fillBeforeMoveLabel: null,
          },
          executionLabels: {
            futureCaptureCount: 3,
            horizonSeconds: 120,
            passiveTouch: false,
            passiveTouchAtSeconds: null,
            adverseMoveBeforePassive: false,
            adverseMoveAtSeconds: null,
            passiveFillBeforeAdverse: false,
            minFutureAskSide: 0.69,
            maxFutureBidSide: 0.68,
            minFutureLastSide: 0.7,
            maxFutureLastSide: 0.8,
            maxPriceImprovementVsLast: 0,
            maxPriceDeteriorationVsLast: 0.1,
          },
        },
      ],
    })

    vi.mocked(buildRecapturePathReport).mockResolvedValue({
      version: 'recapture-path-report/v1',
      generatedAt: '2026-04-29T00:00:00.000Z',
      comparisonCount: 1,
      pathCount: 1,
      multiCapturePathCount: 1,
      meanCapturesPerPath: 2,
      meanDurationSeconds: 120,
      meanCrossSpreadRangeA: 0.09,
      meanKalshiRangeA: 0.02,
      meanPolymarketRangeA: 0.02,
      paths: [
        {
          pathKey: 'fs://1',
          flashscoreMatchUrl: 'fs://1',
          matchId: 'm1',
          teamA: 'A',
          teamB: 'B',
          tourType: 'ATP_CHALLENGER',
          qualityTier: 'high',
          startedAt: '2026-04-29T00:00:00.000Z',
          endedAt: '2026-04-29T00:02:00.000Z',
          durationSeconds: 120,
          captureCount: 2,
          bothAvailableCount: 2,
          kalshi: { actionTransitionCount: 0 } as never,
          polymarket: { actionTransitionCount: 0 } as never,
          crossMarket: { rangeSpreadA: 0.09, signChangeCount: 0 } as never,
        },
      ],
    })

    const report = await buildExecutionSynthesis('/tmp/x')

    expect(report.rowCount).toBe(1)
    expect(report.actionCounts.execute).toBe(1)
    expect(report.rows[0]?.action).toBe('execute')
    expect(report.rows[0]?.riskLevel).toBe('low')
    expect(report.rows[0]?.sizingHint).toBe('half')
    expect(report.rows[0]?.regimeTag).toBe('volatile_dislocation')
    expect(report.rows[0]?.pathContext.captureCount).toBe(2)
    expect(report.rows[0]?.regimePolicy.action).toBe('execute')
    expect(report.rows[0]?.regimePolicy.sizingHint).toBe('half')
    expect(report.rows[0]?.regimePolicy.reasons).toEqual([])
    expect(report.rows[0]?.positionSizingPolicy.bankrollFraction).toBe(0.01)
    expect(report.rows[0]?.positionSizingPolicy.maxPositionUsdPer100kBankroll).toBe(1000)
    expect(report.rows[0]?.positionSizingPolicy.maxLegUsdPer100kBankroll).toBe(500)
    expect(report.rows[0]?.positionSizingPolicy.confidenceTier).toBe('reduced')
    expect(report.rows[0]?.shortlistEligible).toBe(true)
    expect(report.rows[0]?.primaryLeg?.provider).toBe('polymarket')
    expect(report.rows[0]?.supportingLegs).toHaveLength(1)
  })

  it('keeps watch-only rows in research_only bucket', async () => {
    vi.mocked(buildExecutionRankingReport).mockResolvedValue({
      version: 'execution-ranking-report/v1',
      generatedAt: '2026-04-29T00:00:00.000Z',
      rowCount: 1,
      rankedCount: 1,
      topRows: [
        {
          capturedAt: '2026-04-29T00:00:00.000Z',
          matchId: 'm2',
          flashscoreMatchUrl: 'fs://2',
          provider: 'kalshi',
          providerUrl: 'ks://2',
          teamA: 'C',
          teamB: 'D',
          tourType: 'ATP_CHALLENGER',
          qualityTier: 'medium',
          setupType: 'watch_only_dislocation',
          legRole: 'watch_only',
          actionability: 'watch_only',
          side: 'teamB',
          marketEligible: true,
          edgeVsLastSide: 0.12,
          crossSpreadSameSide: null,
          spreadSide: 0.03,
          futureCaptureCount: 0,
          passiveTouch: null,
          passiveFillBeforeAdverse: null,
          adverseMoveBeforePassive: null,
          researchScore: 10,
          executionScore: -20,
          executionEligible: false,
          scoreBreakdown: {} as never,
        },
      ],
      byProviderTop: {
        kalshi: [],
        polymarket: [],
      },
    })

    vi.mocked(buildLabeledExecutionDataset).mockResolvedValue({
      version: 'labeled-execution-dataset/v1',
      generatedAt: '2026-04-29T00:00:00.000Z',
      comparisonCount: 1,
      rowCount: 1,
      labeledRowCount: 0,
      rows: [
        {
          version: 'execution-dataset-row/v1',
          capturedAt: '2026-04-29T00:00:00.000Z',
          matchId: 'm2',
          flashscoreMatchUrl: 'fs://2',
          teamA: 'C',
          teamB: 'D',
          tourType: 'ATP_CHALLENGER',
          qualityTier: 'medium',
          provider: 'kalshi',
          providerUrl: 'ks://2',
          setupType: 'watch_only_dislocation',
          setupReason: '',
          legRole: 'watch_only',
          actionability: 'watch_only',
          side: 'teamB',
          marketEligible: true,
          liveDecisionAction: 'watch_only',
          blockedBy: [],
          pFairSide: 0.65,
          pFairOtherSide: 0.35,
          marketBidSide: 0.5,
          marketAskSide: 0.53,
          marketMidSide: 0.515,
          marketLastSide: 0.53,
          edgeVsBidSide: 0.15,
          edgeVsAskSide: 0.12,
          edgeVsMidSide: 0.135,
          edgeVsLastSide: 0.12,
          spreadSide: 0.03,
          crossSpreadSameSide: null,
          quoteHypotheses: {
            passivePrice: 0.5,
            aggressivePrice: 0.53,
            passiveTouchLabel: null,
            fillBeforeMoveLabel: null,
          },
          executionLabels: {
            futureCaptureCount: 0,
            horizonSeconds: 0,
            passiveTouch: null,
            passiveTouchAtSeconds: null,
            adverseMoveBeforePassive: null,
            adverseMoveAtSeconds: null,
            passiveFillBeforeAdverse: null,
            minFutureAskSide: null,
            maxFutureBidSide: null,
            minFutureLastSide: null,
            maxFutureLastSide: null,
            maxPriceImprovementVsLast: null,
            maxPriceDeteriorationVsLast: null,
          },
        },
      ],
    })

    vi.mocked(buildRecapturePathReport).mockResolvedValue({
      version: 'recapture-path-report/v1',
      generatedAt: '2026-04-29T00:00:00.000Z',
      comparisonCount: 1,
      pathCount: 1,
      multiCapturePathCount: 0,
      meanCapturesPerPath: 1,
      meanDurationSeconds: 0,
      meanCrossSpreadRangeA: null,
      meanKalshiRangeA: null,
      meanPolymarketRangeA: null,
      paths: [
        {
          pathKey: 'fs://2',
          flashscoreMatchUrl: 'fs://2',
          matchId: 'm2',
          teamA: 'C',
          teamB: 'D',
          tourType: 'ATP_CHALLENGER',
          qualityTier: 'medium',
          startedAt: '2026-04-29T00:00:00.000Z',
          endedAt: '2026-04-29T00:00:00.000Z',
          durationSeconds: 0,
          captureCount: 1,
          bothAvailableCount: 0,
          kalshi: { actionTransitionCount: 0 } as never,
          polymarket: { actionTransitionCount: 0 } as never,
          crossMarket: { rangeSpreadA: null, signChangeCount: 0 } as never,
        },
      ],
    })

    const report = await buildExecutionSynthesis('/tmp/x')

    expect(report.rows[0]?.action).toBe('research_only')
    expect(report.rows[0]?.riskLevel).toBe('high')
    expect(report.rows[0]?.sizingHint).toBe('none')
    expect(report.rows[0]?.regimeTag).toBe('single_snapshot')
    expect(report.rows[0]?.regimePolicy.action).toBe('research_only')
    expect(report.rows[0]?.regimePolicy.permitted).toBe(false)
    expect(report.rows[0]?.positionSizingPolicy.bankrollFraction).toBe(0)
    expect(report.rows[0]?.positionSizingPolicy.confidenceTier).toBe('none')
    expect(report.rows[0]?.shortlistEligible).toBe(false)
  })
})
