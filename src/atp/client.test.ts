import { describe, expect, it, vi } from 'vitest'

import { AtpClient, buildAtpPlayerBaseline } from './client.js'

describe('buildAtpPlayerBaseline', () => {
  it('maps ATP hero and stats payloads into a player baseline object', () => {
    const baseline = buildAtpPlayerBaseline({
      hero: {
        FirstName: 'Jannik',
        LastName: 'Sinner',
        Age: 24,
        Nationality: 'Italy',
        HeightCm: 191,
        Plays: 'Right-Handed',
        TurnedPro: 2018,
      },
      stats: {
        FirstStatYear: 2019,
        LastStatYear: 2026,
        Stats: {
          PlayerId: 'S0AG',
          Category: 'Career',
          Surface: 'ALL',
          RankDate: '2026-04-13T00:00:00',
          ServiceRecordStats: {
            Aces: 2555,
            DoubleFaults: 818,
            FirstServePercentage: 60,
            FirstServePointsWonPercentage: 76,
            SecondServePointsWonPercentage: 56,
            BreakPointsFaced: 2167,
            BreakPointsSavedPercentage: 68,
            ServiceGamesPlayed: 5212,
            ServiceGamesWonPercentage: 87,
            TotalServicePointsWonPercentage: 68,
          },
          ReturnRecordStats: {
            FirstServeReturnPointsWonPercentage: 32,
            SecondServeReturnPointsWonPercentage: 54,
            BreakPointsOpportunities: 3406,
            BreakPointsConvertedPercentage: 43,
            ReturnGamesPlayed: 5135,
            ReturnGamesWonPercentage: 28,
            ReturnPointsWonPercentage: 41,
            TotalPointsWonPercentage: 54,
          },
        },
      },
    })

    expect(baseline.playerId).toBe('S0AG')
    expect(baseline.firstName).toBe('Jannik')
    expect(baseline.lastName).toBe('Sinner')
    expect(baseline.serve.serviceGamesWonPercentage).toBe(87)
    expect(baseline.return.totalPointsWonPercentage).toBe(54)
  })
})

describe('AtpClient', () => {
  it('calls the confirmed ATP hero and stats endpoints', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ FirstName: 'Jannik', LastName: 'Sinner' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ Stats: { PlayerId: 'S0AG' } }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      )

    const client = new AtpClient({
      baseUrl: 'https://www.atptour.com',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })

    const baseline = await client.getPlayerBaseline('S0AG')

    expect(fetchImpl).toHaveBeenNthCalledWith(
      1,
      'https://www.atptour.com/en/-/www/players/hero/s0ag?v=1',
      expect.any(Object),
    )
    expect(fetchImpl).toHaveBeenNthCalledWith(
      2,
      'https://www.atptour.com/en/-/www/stats/s0ag/all/all?v=1',
      expect.any(Object),
    )
    expect(baseline.playerId).toBe('S0AG')
    expect(baseline.firstName).toBe('Jannik')
  })
})

