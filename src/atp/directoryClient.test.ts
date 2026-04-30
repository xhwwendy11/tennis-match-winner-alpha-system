import { describe, expect, it, vi } from 'vitest'

import { AtpDirectoryClient, parseAtpPlayerProfileUrl } from './directoryClient.js'

describe('parseAtpPlayerProfileUrl', () => {
  it('parses official ATP player profile urls into directory players', () => {
    expect(parseAtpPlayerProfileUrl('/en/players/oliver-crawford/c0ak/overview')).toEqual({
      rank: null,
      name: 'Oliver Crawford',
      country: null,
      countryCode: null,
      playerId: 'c0ak',
      profileUrl: '/en/players/oliver-crawford/c0ak/overview',
    })
  })
})

describe('AtpDirectoryClient', () => {
  it('finds players by official ATP name lookup', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        {
          PlayerId: 'C0AK',
          FirstName: 'Oliver',
          LastName: 'Crawford',
          NatlId: 'GBR',
        },
      ],
    })

    const client = new AtpDirectoryClient({ fetchImpl: fetchImpl as never })
    const players = await client.findPlayersByName('Oliver Crawford')

    expect(fetchImpl).toHaveBeenCalledWith('https://www.atptour.com/en/-/www/players/find/byname/Oliver%20Crawford/en', {
      method: 'GET',
      headers: { accept: 'application/json' },
    })
    expect(players).toEqual([
      {
        rank: null,
        name: 'Oliver Crawford',
        country: null,
        countryCode: 'GBR',
        playerId: 'C0AK',
        profileUrl: null,
      },
    ])
  })

  it('lists ranked singles players from the official ATP rankings endpoint', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        {
          RankNo: 1,
          Name: 'Jannik Sinner',
          Country: 'Italy',
          CountryCode: 'ITA',
          PlayerId: 'S0AG',
          PlayerProfileUrl: '/en/players/jannik-sinner/s0ag/overview',
        },
      ],
    })

    const client = new AtpDirectoryClient({ fetchImpl: fetchImpl as never })
    const players = await client.listRankedSinglesPlayers()

    expect(fetchImpl).toHaveBeenCalledWith('https://www.atptour.com/en/-/www/rank/sglroll/', {
      method: 'GET',
      headers: { accept: 'application/json' },
    })
    expect(players).toEqual([
      {
        rank: 1,
        name: 'Jannik Sinner',
        country: 'Italy',
        countryCode: 'ITA',
        playerId: 'S0AG',
        profileUrl: '/en/players/jannik-sinner/s0ag/overview',
      },
    ])
  })

  it('finds a player by exact normalized name', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { PlayerId: 'A0E2', FirstName: 'Carlos', LastName: 'Alcaraz', NatlId: 'ESP' },
        ],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { RankNo: 1, Name: 'Jannik Sinner', CountryCode: 'ITA', PlayerId: 'S0AG' },
          { RankNo: 2, Name: 'Carlos Alcaraz', CountryCode: 'ESP', PlayerId: 'A0E2' },
        ],
      })

    const client = new AtpDirectoryClient({ fetchImpl: fetchImpl as never })
    const player = await client.findPlayerByExactName('Carlos   Alcaraz')

    expect(player?.playerId).toBe('A0E2')
  })
})
