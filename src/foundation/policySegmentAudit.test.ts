import { describe, expect, it, vi } from 'vitest'

vi.mock('./resolvedExecutionAudit.js', () => ({
  buildResolvedExecutionAudit: vi.fn(),
}))

import { buildResolvedExecutionAudit } from './resolvedExecutionAudit.js'
import { buildPolicySegmentAudit } from './policySegmentAudit.js'

describe('buildPolicySegmentAudit', () => {
  it('builds segment buckets and recommendations', async () => {
    vi.mocked(buildResolvedExecutionAudit).mockResolvedValue({
      version: 'resolved-execution-audit/v1',
      generatedAt: '2026-04-29T00:00:00.000Z',
      synthesisCount: 3,
      resolvedCount: 3,
      overall: {} as never,
      byAction: [],
      byRegimeTag: [],
      byPrimaryProvider: [],
      rows: [
        {
          capturedAt: '2026-04-29T00:00:00.000Z',
          matchId: 'm1',
          flashscoreMatchUrl: 'fs://1',
          teamA: 'A',
          teamB: 'B',
          tourType: 'ATP_CHALLENGER',
          qualityTier: 'high',
          winner: 'teamA',
          actualA: 1,
          action: 'execute',
          riskLevel: 'high',
          regimeTag: 'action_transitioning',
          regimePermitted: true,
          setupType: 'cross_market_teamA',
          primaryProvider: 'polymarket',
          side: 'teamA',
          pFairSide: 0.7,
          marketLastSide: 0.6,
          edgeVsLastSide: 0.1,
          executionScore: 60,
          bankrollFraction: 0.005,
          confidenceTier: 'pilot',
          correctDirection: true,
        },
        {
          capturedAt: '2026-04-29T00:01:00.000Z',
          matchId: 'm2',
          flashscoreMatchUrl: 'fs://2',
          teamA: 'C',
          teamB: 'D',
          tourType: 'ATP_CHALLENGER',
          qualityTier: 'high',
          winner: 'teamA',
          actualA: 1,
          action: 'execute',
          riskLevel: 'high',
          regimeTag: 'action_transitioning',
          regimePermitted: true,
          setupType: 'cross_market_teamA',
          primaryProvider: 'polymarket',
          side: 'teamA',
          pFairSide: 0.68,
          marketLastSide: 0.59,
          edgeVsLastSide: 0.09,
          executionScore: 58,
          bankrollFraction: 0.005,
          confidenceTier: 'pilot',
          correctDirection: true,
        },
        {
          capturedAt: '2026-04-29T00:02:00.000Z',
          matchId: 'm3',
          flashscoreMatchUrl: 'fs://3',
          teamA: 'E',
          teamB: 'F',
          tourType: 'ATP_CHALLENGER',
          qualityTier: 'low',
          winner: 'teamB',
          actualA: 0,
          action: 'research_only',
          riskLevel: 'extreme',
          regimeTag: 'cross_market_flip',
          regimePermitted: false,
          setupType: 'watch_only_dislocation',
          primaryProvider: 'kalshi',
          side: 'teamA',
          pFairSide: 0.4,
          marketLastSide: 0.7,
          edgeVsLastSide: -0.3,
          executionScore: -10,
          bankrollFraction: 0,
          confidenceTier: 'none',
          correctDirection: false,
        },
      ],
    })

    const report = await buildPolicySegmentAudit('/tmp/x', { outcomeRootDir: '/tmp/outcomes' })

    expect(report.resolvedCount).toBe(3)
    expect(report.overall.correctDirectionRate).toBeCloseTo(2 / 3, 8)
    expect(report.byPrimaryProvider[0]?.key).toBe('polymarket')
    expect(report.byPrimaryProvider[0]?.recommendation).toBe('expand')
    expect(report.byPrimaryProvider[1]?.key).toBe('kalshi')
    expect(report.byPrimaryProvider[1]?.recommendation).toBe('insufficient_data')
  })
})
