import { describe, expect, it, vi } from 'vitest'

import { WtaClient, buildWtaPlayerBaseline } from './client.js'

describe('buildWtaPlayerBaseline', () => {
  it('maps WTA player year payload into a player baseline object', () => {
    const baseline = buildWtaPlayerBaseline({
      playerId: 326408,
      year: 2026,
      payload: {
        player: {
          id: 326408,
          firstName: 'Iga',
          lastName: 'Swiatek',
          countryCode: 'POL',
          dateOfBirth: '2001-05-31',
          turnedPro: 2016,
          plays: 'Right-Handed',
          currentSinglesRanking: 4,
        },
        overview: {
          wonLost: '12 / 6',
          singlesTitles: 0,
          prizeMoney: '$1,261,285',
        },
        servingStats: {
          aces: 56,
          doubleFaults: 46,
          firstServePercentage: 62.2,
          firstServeWon: 67.0,
          secondServeWon: 50.9,
          breakPointsSaved: 60.2,
          servicePointsWon: 60.9,
          serviceGamesWon: 71.7,
          serviceGamesPlayed: 187,
        },
        returnStats: {
          returnPointsWon: 47.4,
          firstReturnPointsWon: 39.7,
          secondReturnPointsWon: 61.1,
          breakPointsConverted: 51.3,
          returnGamesWon: 44.3,
          returnGamesPlayed: 183,
        },
      },
    })

    expect(baseline.playerId).toBe('326408')
    expect(baseline.firstName).toBe('Iga')
    expect(baseline.currentSinglesRanking).toBe(4)
    expect(baseline.serve.serviceGamesWonPercentage).toBe(71.7)
    expect(baseline.return.breakPointsConvertedPercentage).toBe(51.3)
  })

  it('maps current WTA stats payload fields into serve and return baselines', () => {
    const baseline = buildWtaPlayerBaseline({
      playerId: 324576,
      year: 2026,
      payload: {
        player: {
          id: 324576,
          firstName: 'Lulu',
          lastName: 'Sun',
          countryCode: 'NZL',
        },
        stats: {
          Aces: 18,
          Current_Rank: 106,
          Double_Faults: 17,
          Return_Games_Played: 55,
          Service_Games_Played: 51,
          breakpoint_converted_percent: 28.6,
          breakpoint_saved_percent: 59.1,
          first_return_percent: 25.4,
          first_serve_percent: 57.5,
          first_serve_won_percent: 67.3,
          return_games_won_percent: 14.5,
          return_points_won_percent: 33.2,
          second_return_percent: 47.3,
          second_serve_won_percent: 42.3,
          service_games_won_percent: 64.7,
          service_points_won_percent: 56.7,
        },
      },
    })

    expect(baseline.currentSinglesRanking).toBe(106)
    expect(baseline.serve.aces).toBe(18)
    expect(baseline.serve.doubleFaults).toBe(17)
    expect(baseline.serve.firstServePercentage).toBe(57.5)
    expect(baseline.serve.serviceGamesWonPercentage).toBe(64.7)
    expect(baseline.return.returnGamesWonPercentage).toBe(14.5)
    expect(baseline.return.returnPointsWonPercentage).toBe(33.2)
    expect(baseline.return.breakPointsConvertedPercentage).toBe(28.6)
  })
})

describe('WtaClient', () => {
  it('calls the confirmed WTA player year endpoint', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          player: {
            id: 326408,
            firstName: 'Iga',
            lastName: 'Swiatek',
          },
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
      ),
    )

    const client = new WtaClient({
      baseUrl: 'https://api.wtatennis.com',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })

    const baseline = await client.getPlayerBaseline(326408, 2026)

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://api.wtatennis.com/tennis/players/326408/year/2026',
      expect.any(Object),
    )
    expect(baseline.playerId).toBe('326408')
    expect(baseline.firstName).toBe('Iga')
  })
})
