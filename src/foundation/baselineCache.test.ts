import { describe, expect, it } from 'vitest'

import { MemoryBaselineCache, serializeBaselineCacheKey } from './baselineCache.js'

describe('baselineCache', () => {
  it('serializes a stable key for source-specific baseline records', () => {
    expect(
      serializeBaselineCacheKey({
        source: 'atp',
        sourcePlayerId: 'S0AG',
        year: 'all',
        surface: 'all',
      }),
    ).toBe('atp::S0AG::all::all::::')
  })

  it('stores and retrieves baseline cache records', () => {
    const cache = new MemoryBaselineCache()
    cache.set({
      key: {
        source: 'wta',
        sourcePlayerId: '326408',
        year: 2026,
      },
      fetchedAt: '2026-04-16T00:00:00Z',
      baseline: {
        source: 'wta',
        playerId: '326408',
        firstName: 'Iga',
        lastName: 'Swiatek',
        countryCode: 'POL',
        dateOfBirth: null,
        turnedPro: null,
        plays: null,
        currentSinglesRanking: 1,
        year: 2026,
        overview: {
          wonLost: null,
          singlesTitles: null,
          prizeMoney: null,
        },
        serve: {
          aces: null,
          doubleFaults: null,
          firstServePercentage: null,
          firstServeWonPercentage: null,
          secondServeWonPercentage: null,
          breakPointsSavedPercentage: null,
          servicePointsWonPercentage: null,
          serviceGamesWonPercentage: null,
          serviceGamesPlayed: null,
        },
        return: {
          returnPointsWonPercentage: null,
          firstReturnPointsWonPercentage: null,
          secondReturnPointsWonPercentage: null,
          breakPointsConvertedPercentage: null,
          returnGamesWonPercentage: null,
          returnGamesPlayed: null,
        },
      },
    })

    const record = cache.get({
      source: 'wta',
      sourcePlayerId: '326408',
      year: 2026,
    })

    expect(record?.baseline.source).toBe('wta')
    expect(record?.baseline.playerId).toBe('326408')
  })
})
