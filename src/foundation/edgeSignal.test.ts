import { describe, expect, it } from 'vitest'

import { buildEdgeSignal } from './edgeSignal.js'
import type { FairMarketComparison } from './fairMarketComparison.js'

function makeComparison(overrides: Partial<FairMarketComparison> = {}): FairMarketComparison {
  return {
    available: true,
    marketTicker: 'mkt',
    marketStatus: 'OPEN',
    marketYesSide: 'teamA',
    fairProbA: 0.65,
    fairProbB: 0.35,
    marketProbA: { bid: null, ask: null, mid: null, last: 0.55 },
    marketProbB: { bid: null, ask: null, mid: null, last: 0.45 },
    edgeA: { vsBid: null, vsAsk: null, vsMid: null, vsLast: 0.1 },
    edgeB: { vsBid: null, vsAsk: null, vsMid: null, vsLast: -0.1 },
    ...overrides,
  }
}

describe('buildEdgeSignal', () => {
  it('promotes medium/high quality strong edges to candidates', () => {
    const signal = buildEdgeSignal({
      fairVsMarket: makeComparison(),
      qualityTier: 'medium',
    })

    expect(signal.action).toBe('candidate')
    expect(signal.strength).toBe('strong')
    expect(signal.side).toBe('teamA')
  })

  it('keeps low quality edges as watch only', () => {
    const signal = buildEdgeSignal({
      fairVsMarket: makeComparison(),
      qualityTier: 'low',
    })

    expect(signal.action).toBe('watch_only')
    expect(signal.reason).toBe('low_quality_edge')
  })

  it('ignores unavailable fair-vs-market states', () => {
    const signal = buildEdgeSignal({
      fairVsMarket: makeComparison({ available: false }),
      qualityTier: 'high',
    })

    expect(signal.action).toBe('ignore')
    expect(signal.available).toBe(false)
  })
})
