import { describe, expect, it, vi } from 'vitest'

import { ItfClient, buildItfPlayerBaseline } from './client.js'

describe('buildItfPlayerBaseline', () => {
  it('maps ITF overview and win-loss payloads into a player baseline object', () => {
    const baseline = buildItfPlayerBaseline({
      playerId: '800564568',
      overview: {
        playerId: 800564568,
        firstName: 'Lilli',
        lastName: 'Tagger',
        fullName: 'Lilli Tagger',
        nationality: 'Austria',
        age: 18,
        dateOfBirth: '2007-02-11',
        currentSinglesRank: 422,
        currentWtnRank: 50,
        hand: 'Right-handed',
      },
      winLoss: {
        winLoss: {
          singles: {
            overall: {
              wins: 24,
              losses: 9,
              winPercentage: 72.7,
            },
            clay: {
              wins: 12,
              losses: 3,
              winPercentage: 80,
            },
          },
        },
      },
    })

    expect(baseline.playerId).toBe('800564568')
    expect(baseline.fullName).toBe('Lilli Tagger')
    expect(baseline.currentSinglesRank).toBe(422)
    expect(baseline.overview.overallWinPercentage).toBe(72.7)
    expect(baseline.overview.clayWinPercentage).toBe(80)
    expect(baseline.serve.serviceGamesWonPercentage).toBeNull()
  })
})

describe('ItfClient', () => {
  it('calls the confirmed ITF overview and win-loss endpoints', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ playerId: 800564568, firstName: 'Lilli', lastName: 'Tagger' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            winLoss: {
              singles: {
                overall: { wins: 24, losses: 9, winPercentage: 72.7 },
              },
            },
          }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' },
          },
        ),
      )

    const client = new ItfClient({
      baseUrl: 'https://www.itftennis.com',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })

    const baseline = await client.getPlayerBaseline('800564568', {
      circuitCode: 'WT',
      matchTypeCode: 'S',
      year: 2026,
    })

    expect(fetchImpl).toHaveBeenNthCalledWith(
      1,
      'https://www.itftennis.com/tennis/api/PlayerApi/GetPlayerOverview?playerId=800564568&circuitCode=WT&matchTypeCode=S',
      expect.any(Object),
    )
    expect(fetchImpl).toHaveBeenNthCalledWith(
      2,
      'https://www.itftennis.com/tennis/api/PlayerApi/GetPlayerWinLoss?playerId=800564568&circuitCode=WT&matchTypeCode=S&year=2026',
      expect.any(Object),
    )
    expect(baseline.playerId).toBe('800564568')
    expect(baseline.firstName).toBe('Lilli')
  })
})
