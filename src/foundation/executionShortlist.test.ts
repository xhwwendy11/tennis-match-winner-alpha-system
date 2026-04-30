import { describe, expect, it, vi } from 'vitest'

import { buildExecutionShortlist } from './executionShortlist.js'

vi.mock('./executionRanking.js', () => ({
  buildExecutionRankingReport: vi.fn(),
}))

import { buildExecutionRankingReport } from './executionRanking.js'

describe('execution shortlist', () => {
  it('filters ranking output down to execution-eligible rows only', async () => {
    vi.mocked(buildExecutionRankingReport).mockResolvedValue({
      version: 'execution-ranking-report/v1',
      generatedAt: '2026-04-29T00:00:00.000Z',
      rowCount: 3,
      rankedCount: 3,
      topRows: [
        {
          provider: 'polymarket',
          executionEligible: true,
          executionScore: 60,
        },
        {
          provider: 'kalshi',
          executionEligible: false,
          executionScore: 20,
        },
        {
          provider: 'kalshi',
          executionEligible: true,
          executionScore: 10,
        },
      ] as never,
      byProviderTop: {
        kalshi: [
          { provider: 'kalshi', executionEligible: false, executionScore: 20 },
          { provider: 'kalshi', executionEligible: true, executionScore: 10 },
        ] as never,
        polymarket: [{ provider: 'polymarket', executionEligible: true, executionScore: 60 }] as never,
      },
    })

    const shortlist = await buildExecutionShortlist('multi-market-comparisons', { limit: 10 })
    expect(shortlist.shortlistCount).toBe(2)
    expect(shortlist.shortlist.every((row) => row.executionEligible)).toBe(true)
    expect(shortlist.byProvider.kalshi).toHaveLength(1)
    expect(shortlist.byProvider.polymarket).toHaveLength(1)
  })
})
