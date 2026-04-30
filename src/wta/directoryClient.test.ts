import { describe, expect, it, vi } from 'vitest'

import { WtaOfficialDirectoryClient, parseWtaPlayersPage, parseWtaRankedPlayers } from './directoryClient.js'

describe('parseWtaPlayersPage', () => {
  it('extracts player ids, names, and profile urls from the official players page', () => {
    const players = parseWtaPlayersPage(`
      <div class="players-list__item" data-player-id="326408" data-player-name="Iga Swiatek">
        <a class="players-list__url" href="/players/326408/iga-swiatek"></a>
      </div>
      <div class="players-list__item" data-player-id="320760" data-player-name="Aryna Sabalenka">
        <a class="players-list__url" href="/players/320760/aryna-sabalenka"></a>
      </div>
    `)

    expect(players).toEqual([
      { playerId: '326408', name: 'Iga Swiatek', profileUrl: '/players/326408/iga-swiatek' },
      { playerId: '320760', name: 'Aryna Sabalenka', profileUrl: '/players/320760/aryna-sabalenka' },
    ])
  })
})

describe('parseWtaRankedPlayers', () => {
  it('extracts player ids and names from the official ranked players API', () => {
    const players = parseWtaRankedPlayers([
      {
        player: {
          id: 324576,
          firstName: 'Lulu',
          lastName: 'Sun',
          fullName: 'Lulu Sun',
        },
      },
      {
        player: {
          id: 316266,
          firstName: 'Martina',
          lastName: 'Trevisan',
          fullName: 'Martina Trevisan',
        },
      },
    ])

    expect(players).toEqual([
      { playerId: '324576', name: 'Lulu Sun', profileUrl: '/players/324576/lulu-sun' },
      { playerId: '316266', name: 'Martina Trevisan', profileUrl: '/players/316266/martina-trevisan' },
    ])
  })
})

describe('WtaOfficialDirectoryClient', () => {
  it('uses the official ranked players API before falling back to the players page', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify([
          {
            player: {
              id: 324576,
              firstName: 'Lulu',
              lastName: 'Sun',
              fullName: 'Lulu Sun',
            },
          },
        ]),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    )

    const client = new WtaOfficialDirectoryClient({
      baseUrl: 'https://www.wtatennis.com',
      apiBaseUrl: 'https://api.wtatennis.com',
      fetchImpl: fetchImpl as never,
    })

    const player = await client.findPlayerByExactName('  Lulu   Sun ')

    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(String(fetchImpl.mock.calls[0]?.[0])).toContain('https://api.wtatennis.com/tennis/players/ranked?')
    expect(fetchImpl.mock.calls[0]?.[1]).toEqual({
      method: 'GET',
      headers: { accept: 'application/json', account: 'wta' },
    })
    expect(player).toEqual({
      playerId: '324576',
      name: 'Lulu Sun',
      profileUrl: '/players/324576/lulu-sun',
    })
  })

  it('falls back to the official players page when ranked search has no exact match', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify([]), { status: 200, headers: { 'content-type': 'application/json' } }),
    ).mockResolvedValueOnce(
      new Response(
        `
          <div class="players-list__item" data-player-id="326408" data-player-name="Iga Swiatek">
            <a class="players-list__url" href="/players/326408/iga-swiatek"></a>
          </div>
          <div class="players-list__item" data-player-id="320760" data-player-name="Aryna Sabalenka">
            <a class="players-list__url" href="/players/320760/aryna-sabalenka"></a>
          </div>
        `,
        { status: 200, headers: { 'content-type': 'text/html' } },
      ),
    )

    const client = new WtaOfficialDirectoryClient({
      baseUrl: 'https://www.wtatennis.com',
      apiBaseUrl: 'https://api.wtatennis.com',
      fetchImpl: fetchImpl as never,
    })

    const player = await client.findPlayerByExactName('  Iga   Swiatek ')

    expect(fetchImpl).toHaveBeenLastCalledWith('https://www.wtatennis.com/players', {
      method: 'GET',
      headers: { accept: 'text/html,application/xhtml+xml' },
    })
    expect(player).toEqual({
      playerId: '326408',
      name: 'Iga Swiatek',
      profileUrl: '/players/326408/iga-swiatek',
    })
  })
})
