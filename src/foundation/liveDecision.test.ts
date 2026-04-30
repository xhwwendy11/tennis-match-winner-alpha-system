import { describe, expect, it } from 'vitest'

import { buildLiveDecision } from './liveDecision.js'

describe('buildLiveDecision', () => {
  it('keeps ordinary watch-only decisions unchanged', () => {
    const decision = buildLiveDecision({
      edgeSignal: {
        available: true,
        side: 'teamA',
        strength: 'weak',
        action: 'watch_only',
        edgeVsLast: 0.04,
        reason: 'weak_edge',
      },
      marketEligibility: {
        eligible: false,
        reasons: ['low_volume'],
        metrics: {
          volume: 100,
          marketStatus: 'OPEN',
          marketProbALast: 0.5,
          marketProbBLast: 0.5,
          marketProbAAsk: 0.51,
          marketProbBAsk: 0.51,
          askOverround: 0.02,
          marketAgeSeconds: 5,
        },
        rule: {
          requireOpen: true,
          requireFairComparison: true,
          requireLastPrice: true,
          requireTwoSidedAsk: true,
          minVolume: 500000,
          maxAskOverround: 0.02,
          maxMarketAgeSeconds: 10,
        },
      },
    })

    expect(decision).toMatchObject({
      action: 'watch_only',
      marketEligible: false,
      blockedBy: ['low_volume'],
    })
  })

  it('downgrades candidate signals when market eligibility fails', () => {
    const decision = buildLiveDecision({
      edgeSignal: {
        available: true,
        side: 'teamB',
        strength: 'strong',
        action: 'candidate',
        edgeVsLast: 0.28,
        reason: 'quality_adjusted_edge_candidate',
      },
      marketEligibility: {
        eligible: false,
        reasons: ['wide_ask_overround', 'stale_market_timestamp'],
        metrics: {
          volume: 600000,
          marketStatus: 'OPEN',
          marketProbALast: 0.7,
          marketProbBLast: 0.3,
          marketProbAAsk: 0.72,
          marketProbBAsk: 0.31,
          askOverround: 0.03,
          marketAgeSeconds: 12,
        },
        rule: {
          requireOpen: true,
          requireFairComparison: true,
          requireLastPrice: true,
          requireTwoSidedAsk: true,
          minVolume: 500000,
          maxAskOverround: 0.02,
          maxMarketAgeSeconds: 10,
        },
      },
    })

    expect(decision).toMatchObject({
      action: 'candidate_but_ineligible',
      side: 'teamB',
      marketEligible: false,
      reason: 'candidate_blocked_by_market_eligibility',
      blockedBy: ['wide_ask_overround', 'stale_market_timestamp'],
    })
  })

  it('preserves eligible candidates as candidates', () => {
    const decision = buildLiveDecision({
      edgeSignal: {
        available: true,
        side: 'teamA',
        strength: 'strong',
        action: 'candidate',
        edgeVsLast: 0.22,
        reason: 'quality_adjusted_edge_candidate',
      },
      marketEligibility: {
        eligible: true,
        reasons: [],
        metrics: {
          volume: 1000000,
          marketStatus: 'OPEN',
          marketProbALast: 0.4,
          marketProbBLast: 0.6,
          marketProbAAsk: 0.41,
          marketProbBAsk: 0.6,
          askOverround: 0.01,
          marketAgeSeconds: 8,
        },
        rule: {
          requireOpen: true,
          requireFairComparison: true,
          requireLastPrice: true,
          requireTwoSidedAsk: true,
          minVolume: 500000,
          maxAskOverround: 0.02,
          maxMarketAgeSeconds: 10,
        },
      },
    })

    expect(decision).toMatchObject({
      action: 'candidate',
      marketEligible: true,
      blockedBy: [],
    })
  })
})
