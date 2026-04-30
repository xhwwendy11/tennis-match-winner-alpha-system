import { describe, expect, it, vi } from 'vitest'

import { buildExecutionStudy } from './executionStudy.js'

vi.mock('./labeledExecutionDataset.js', () => ({
  buildLabeledExecutionDataset: vi.fn(),
}))

import { buildLabeledExecutionDataset } from './labeledExecutionDataset.js'

describe('buildExecutionStudy', () => {
  it('aggregates labeled execution rows into execution buckets', async () => {
    vi.mocked(buildLabeledExecutionDataset).mockResolvedValue({
      version: 'labeled-execution-dataset/v1',
      generatedAt: '2026-04-29T00:00:00.000Z',
      comparisonCount: 2,
      rowCount: 3,
      labeledRowCount: 2,
      rows: [
        {
          setupType: 'cross_market_teamA',
          provider: 'polymarket',
          legRole: 'cheap_leg',
          actionability: 'direct_candidate',
          tourType: 'ATP_CHALLENGER',
          qualityTier: 'high',
          edgeVsLastSide: 0.11,
          crossSpreadSameSide: 0.09,
          spreadSide: 0.01,
          executionLabels: {
            futureCaptureCount: 2,
            passiveTouch: true,
            passiveTouchAtSeconds: 120,
            passiveFillBeforeAdverse: true,
            adverseMoveBeforePassive: false,
            adverseMoveAtSeconds: null,
          },
        },
        {
          setupType: 'cross_market_teamA',
          provider: 'kalshi',
          legRole: 'rich_leg',
          actionability: 'direct_candidate',
          tourType: 'ATP_CHALLENGER',
          qualityTier: 'high',
          edgeVsLastSide: 0.02,
          crossSpreadSameSide: 0.09,
          spreadSide: null,
          executionLabels: {
            futureCaptureCount: 2,
            passiveTouch: false,
            passiveTouchAtSeconds: null,
            passiveFillBeforeAdverse: false,
            adverseMoveBeforePassive: true,
            adverseMoveAtSeconds: 120,
          },
        },
        {
          setupType: 'watch_only_dislocation',
          provider: 'kalshi',
          legRole: 'watch_only',
          actionability: 'watch_only',
          tourType: 'ATP_CHALLENGER',
          qualityTier: 'low',
          edgeVsLastSide: -0.36,
          crossSpreadSameSide: null,
          spreadSide: null,
          executionLabels: {
            futureCaptureCount: 0,
            passiveTouch: null,
            passiveTouchAtSeconds: null,
            passiveFillBeforeAdverse: null,
            adverseMoveBeforePassive: null,
            adverseMoveAtSeconds: null,
          },
        },
      ] as never,
    })

    const study = await buildExecutionStudy('multi-market-comparisons')

    expect(study.rowCount).toBe(3)
    expect(study.labeledRowCount).toBe(2)
    expect(study.overall.passiveTouchCount).toBe(1)
    expect(study.overall.adverseMoveBeforePassiveCount).toBe(1)
    expect(study.bySetupType.find((bucket) => bucket.key === 'cross_market_teamA')?.sampleCount).toBe(2)
    expect(study.byProvider.find((bucket) => bucket.key === 'polymarket')?.passiveTouchRate).toBe(1)
  })
})
