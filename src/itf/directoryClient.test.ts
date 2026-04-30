import { describe, expect, it, vi } from 'vitest'

import { ItfOfficialDirectoryClient, isIncapsulaBlockPage, parseItfPlayersPage } from './directoryClient.js'

describe('parseItfPlayersPage', () => {
  it('extracts player ids and source meta from ITF profile links', () => {
    const players = parseItfPlayersPage(`
      <a href="/en/players/lilli-tagger/800564568/aut/wt/S/overview/">Lilli Tagger</a>
      <a href="/en/players/pedro-boscardin-dias/800519972/bra/jt/s/overview/">Pedro Boscardin Dias</a>
    `)

    expect(players).toEqual([
      {
        playerId: '800564568',
        name: 'Lilli Tagger',
        profileUrl: '/en/players/lilli-tagger/800564568/aut/wt/S/overview/',
        meta: { circuitCode: 'WT', matchTypeCode: 'S' },
      },
      {
        playerId: '800519972',
        name: 'Pedro Boscardin Dias',
        profileUrl: '/en/players/pedro-boscardin-dias/800519972/bra/jt/s/overview/',
        meta: { circuitCode: 'JT', matchTypeCode: 'S' },
      },
    ])
  })
})

describe('isIncapsulaBlockPage', () => {
  it('detects the ITF anti-bot block page', () => {
    expect(isIncapsulaBlockPage('<html><script src="/_Incapsula_Resource?x=1"></script></html>')).toBe(true)
    expect(isIncapsulaBlockPage('<html>normal page</html>')).toBe(false)
  })
})

describe('ItfOfficialDirectoryClient', () => {
  it('returns null when the official players page is anti-bot blocked', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response('<html><iframe src="/_Incapsula_Resource?foo=bar">Request unsuccessful. Incapsula incident ID</iframe></html>', {
        status: 200,
        headers: { 'content-type': 'text/html' },
      }),
    )

    const client = new ItfOfficialDirectoryClient({
      baseUrl: 'https://www.itftennis.com',
      fetchImpl: fetchImpl as never,
    })

    const player = await client.findPlayerByExactName('Lilli Tagger')

    expect(fetchImpl).toHaveBeenCalledWith('https://www.itftennis.com/en/players/', {
      method: 'GET',
      headers: { accept: 'text/html,application/xhtml+xml' },
    })
    expect(player).toBeNull()
  })

  it('finds a player by exact normalized name when player links are present', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        '<a href="/en/players/lilli-tagger/800564568/aut/wt/S/overview/">Lilli Tagger</a>',
        {
          status: 200,
          headers: { 'content-type': 'text/html' },
        },
      ),
    )

    const client = new ItfOfficialDirectoryClient({
      baseUrl: 'https://www.itftennis.com',
      fetchImpl: fetchImpl as never,
    })

    const player = await client.findPlayerByExactName('  Lilli   Tagger ')

    expect(player).toEqual({
      playerId: '800564568',
      name: 'Lilli Tagger',
      profileUrl: '/en/players/lilli-tagger/800564568/aut/wt/S/overview/',
      meta: { circuitCode: 'WT', matchTypeCode: 'S' },
    })
  })
})
