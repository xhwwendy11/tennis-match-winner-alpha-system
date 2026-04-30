import { describe, expect, it, vi } from 'vitest'

import { extractMatchByUrl, detectSport, normalizeFlashscoreUrl, parseKalshiMarketTicker } from './extractMatchByUrl.js'

vi.mock('../realtime-score/tennis/scoreboardClient.js', () => ({
  fetchDirectMatchPage: vi.fn(async () => [
    {
      eventId: 'event-1',
      tournamentName: 'ATP Monte Carlo',
      tournamentPath: 'https://www.flashscore.com/tennis/atp-singles/monte-carlo/',
      tournamentLabel: 'ATP Monte Carlo',
      round: 'Round of 32',
      startTimeISO: '2026-04-12T18:00:00Z',
      status: 'LIVE',
      statusText: 'Live',
      teamA: {
        name: 'Daniil Medvedev',
        shortName: 'Medvedev',
        code: 'MED',
        slug: 'medvedev',
        playerId: 'a1',
        score: 0,
      },
      teamB: {
        name: 'Matteo Berrettini',
        shortName: 'Berrettini',
        code: 'BER',
        slug: 'berrettini',
        playerId: 'b1',
        score: 1,
      },
      currentSet: { label: 'Set 2', teamAScore: '0', teamBScore: '2' },
      currentGame: { teamAScore: '0', teamBScore: '0' },
      serverSide: 'teamB',
      serverSideResolved: 'teamB',
      serverSideSource: 'dom',
      serveConfidence: 'high',
      serverPlayerName: 'Matteo Berrettini',
      stats: {
        acesA: 2,
        acesB: 1,
        doubleFaultsA: 2,
        doubleFaultsB: 0,
        firstServePercentageA: '65%',
        firstServePercentageB: '87%',
        firstServeWonA: '69% (36/52)',
        firstServeWonB: '66% (56/85)',
        secondServeWonA: '54% (15/28)',
        secondServeWonB: '31% (4/13)',
        breakPointsSavedA: '3/5',
        breakPointsSavedB: '9/10',
        breakPointsConvertedA: '1/10',
        breakPointsConvertedB: '2/10',
        serviceGamesPlayedA: '8/10',
        serviceGamesPlayedB: '9/10',
        returnGamesPlayedA: '1/10',
        returnGamesPlayedB: '2/10',
        pointsWonA: 57,
        pointsWonB: 79,
        serviceGamesWonA: 8,
        serviceGamesWonB: 9,
        breakPointsDisplayA: '1/10',
        breakPointsDisplayB: '2/10',
      },
      sets: [
        { label: 'Set 1', teamAScore: '6', teamBScore: '7' },
        { label: 'Set 2', teamAScore: '0', teamBScore: '2' },
      ],
      matchUrl: 'https://www.flashscore.com/match/tennis/foo/bar/',
      sourcePageUrl: 'https://www.flashscore.com/match/tennis/foo/bar/?mid=abc',
    },
  ]),
}))

vi.mock('../actions/machineCommandExecutor.js', () => ({
  executeMachineCommand: vi.fn(async () => ({
    executed: false,
    command: null,
    note: 'mocked',
  })),
}))

vi.mock('../kalshi/statsExtractor.js', () => ({
  extractKalshiDisplayStats: vi.fn(async () => ({
    acesA: 3,
    acesB: 4,
    doubleFaultsA: 1,
    doubleFaultsB: 2,
    pointsWonA: 58,
    pointsWonB: 81,
    firstServeWonA: '37/53',
    firstServeWonB: '57/86',
    secondServeWonA: '16/31',
    secondServeWonB: '5/14',
    serviceGamesWonA: 8,
    serviceGamesWonB: 9,
    breakPointsDisplayA: '1/9',
    breakPointsDisplayB: '2/10',
  })),
  extractCanonicalKalshiMarketStateFromPage: vi.fn(async () => ({
    eventTicker: 'KXATP-123',
    marketTicker: 'KXATP-PAGE',
    marketTitle: 'Will Medvedev beat Berrettini?',
    marketStatus: 'OPEN',
    prices: {
      yesBid: null,
      yesAsk: 59,
      noBid: null,
      noAsk: 43,
      lastPrice: 58,
    },
    liquidity: {
      volume: 150000,
    },
    timestamps: {
      marketTimestamp: '2026-04-14T05:00:00Z',
    },
  })),
}))

vi.mock('../kalshi/marketClient.js', () => ({
  fetchCanonicalKalshiMarketState: vi.fn(async (ticker: string) => ({
    eventTicker: 'KXATP-123',
    marketTicker: ticker,
    marketTitle: 'Will Medvedev beat Berrettini?',
    marketStatus: 'OPEN',
    prices: {
      yesBid: 57,
      yesAsk: 59,
      noBid: 41,
      noAsk: 43,
      lastPrice: 58,
    },
    liquidity: {
      volume: 150000,
    },
    timestamps: {
      marketTimestamp: '2026-04-14T05:00:00Z',
    },
  })),
}))

vi.mock('../polymarket/liveExtractor.js', () => ({
  extractCanonicalPolymarketMarketStateFromPage: vi.fn(async () => ({
    eventTicker: 'wta-erjavec-lansere-2026-04-28',
    marketTicker: 'wta-erjavec-lansere-2026-04-28',
    marketTitle: 'Daniil Medvedev vs Matteo Berrettini',
    marketStatus: 'OPEN',
    prices: {
      yesBid: 66,
      yesAsk: 67,
      noBid: 33,
      noAsk: 34,
      lastPrice: 68,
    },
    liquidity: {
      volume: 5453.08,
    },
    timestamps: {
      marketTimestamp: '2026-04-14T05:00:00Z',
    },
  })),
}))

describe('normalizeFlashscoreUrl', () => {
  it('normalizes protocol, host, and strips hash', () => {
    expect(
      normalizeFlashscoreUrl(
        'http://flashscore.com/match/tennis/foo/bar/?mid=abc#section',
      ),
    ).toBe('https://www.flashscore.com/match/tennis/foo/bar/?mid=abc')
  })

  it('rejects non-flashscore hosts', () => {
    expect(() => normalizeFlashscoreUrl('https://example.com/match/tennis/foo/bar/')).toThrow('URL must point to flashscore')
  })
})

describe('detectSport', () => {
  it('detects tennis match URLs', () => {
    expect(detectSport('https://www.flashscore.com/match/tennis/foo/bar/')).toBe('tennis')
  })

  it('rejects unsupported sports', () => {
    expect(() => detectSport('https://www.flashscore.com/match/football/foo/bar/')).toThrow('Unsupported sport in URL: football')
    expect(() => detectSport('https://www.flashscore.com/match/baseball/foo/bar/')).toThrow('Unsupported sport in URL: baseball')
  })

  it('rejects non-match URLs', () => {
    expect(() => detectSport('https://www.flashscore.com/tennis/atp-singles/')).toThrow(
      'Only direct Flashscore match URLs are supported',
    )
  })
})

describe('parseKalshiMarketTicker', () => {
  it('extracts the last market path segment from a kalshi market url', () => {
    expect(
      parseKalshiMarketTicker(
        'https://kalshi.com/markets/kxatpchallengermatch/challenger-atp-/kxatpchallengermatch-26apr13popkin',
      ),
    ).toBe('kxatpchallengermatch-26apr13popkin')
  })
})

describe('extractMatchByUrl', () => {
  it('returns canonicalMatchState alongside the raw match payload', async () => {
    const result = await extractMatchByUrl('https://www.flashscore.com/match/tennis/foo/bar/?mid=abc')

    expect(result.ok).toBe(true)
    expect(result.match?.eventId).toBe('event-1')
    expect(result.canonicalMatchState?.matchId).toBe('event-1')
    expect(result.canonicalMatchState?.competition.tourType).toBe('ATP')
    expect(result.canonicalMatchState?.stats.pointsWonB).toBe(79)
    expect(result.flashscoreRawStats?.pointsWonB).toBe(79)
    expect(result.kalshiMarketUrl).toBeNull()
    expect(result.kalshiDisplayStats).toBeNull()
    expect(result.resolvedStats.pointsWonB).toEqual({
      value: 79,
      source: 'flashscore',
      confidence: 'medium',
    })
    expect(result.prematchBaseline?.source).toBe('fallback')
    expect(result.probabilityState.pFair.match.source).toBe('derived')
    expect(result.probabilityState.pFair.match.pMatchA).not.toBeNull()
    expect(result.probabilityState.risk.matchedRule).toBe(result.pointRisk.matchedRule)
    expect(result.decisionSnapshot.match.matchId).toBe('event-1')
    expect(result.decisionSnapshot.sourceCoverage.flashscoreStatsAvailable).toBe(true)
    expect(result.decisionSnapshot.stats.resolved.pointsWonB.value).toBe(79)
  })

  it('uses Kalshi display stats when kalshiMarketUrl is provided', async () => {
    const result = await extractMatchByUrl(
      'https://www.flashscore.com/match/tennis/foo/bar/?mid=abc',
      { kalshiMarketUrl: 'https://kalshi.com/markets/example' },
    )

    expect(result.kalshiMarketUrl).toBe('https://kalshi.com/markets/example')
    expect(result.kalshiDisplayStats?.pointsWonB).toBe(81)
    expect(result.resolvedStats.pointsWonB).toEqual({
      value: 81,
      source: 'kalshi_ui',
      confidence: 'high',
    })
    expect(result.resolvedStats.breakPointsDisplayB).toEqual({
      value: '2/10',
      source: 'kalshi_ui',
      confidence: 'low',
    })
    expect(result.decisionSnapshot.sourceCoverage.kalshiStatsAvailable).toBe(true)
    expect(result.decisionSnapshot.stats.kalshiDisplay?.pointsWonB).toBe(81)
    expect(result.prematchBaseline?.source).toBe('fallback')
    expect(result.prematchBaseline?.prematchFairProbA).toBeNull()
    expect(result.decisionSnapshot.fairVsMarket.marketProbA.last).toBe(0.58)
    expect(result.probabilityState.pFair.match.source).not.toBe('none')
  })

  it('passes canonical market state into the snapshot when provided directly', async () => {
    const result = await extractMatchByUrl(
      'https://www.flashscore.com/match/tennis/foo/bar/?mid=abc',
      {
        canonicalMarketState: {
          eventTicker: 'KXATP-123',
          marketTicker: 'KXATP-123-A',
          marketTitle: 'Will Medvedev beat Berrettini?',
          marketStatus: 'OPEN',
          prices: {
            yesBid: 57,
            yesAsk: 59,
            noBid: 41,
            noAsk: 43,
            lastPrice: 58,
          },
          liquidity: {
            volume: 150000,
          },
          timestamps: {
            marketTimestamp: '2026-04-14T05:00:00Z',
          },
        },
      },
    )

    expect(result.canonicalMarketState?.marketTicker).toBe('KXATP-123-A')
    expect(result.decisionSnapshot.sourceCoverage.marketStateAvailable).toBe(true)
    expect(result.decisionSnapshot.fairVsMarket.marketProbA.mid).toBeCloseTo(0.58, 6)
  })

  it('can build canonical market state from kalshi url and injected kalshi client', async () => {
    const result = await extractMatchByUrl(
      'https://www.flashscore.com/match/tennis/foo/bar/?mid=abc',
      {
        kalshiMarketUrl: 'https://kalshi.com/markets/kxatpchallengermatch/challenger-atp-/kxatpchallengermatch-26apr13popkin',
        kalshiClient: {} as never,
      },
    )

    expect(result.canonicalMarketState?.marketTicker).toBe('kxatpchallengermatch-26apr13popkin')
    expect(result.decisionSnapshot.sourceCoverage.marketStateAvailable).toBe(true)
  })

  it('can build canonical market state from polymarket url', async () => {
    const result = await extractMatchByUrl(
      'https://www.flashscore.com/match/tennis/foo/bar/?mid=abc',
      {
        polymarketMarketUrl: 'https://polymarket.com/sports/wta/wta-erjavec-lansere-2026-04-28',
      },
    )

    expect(result.polymarketMarketUrl).toBe('https://polymarket.com/sports/wta/wta-erjavec-lansere-2026-04-28')
    expect(result.kalshiDisplayStats).toBeNull()
    expect(result.canonicalMarketState?.marketTicker).toBe('wta-erjavec-lansere-2026-04-28')
    expect(result.decisionSnapshot.sourceCoverage.marketStateAvailable).toBe(true)
  })

  it('passes prematchBaseline through to probabilityState', async () => {
    const result = await extractMatchByUrl(
      'https://www.flashscore.com/match/tennis/foo/bar/?mid=abc',
      {
        prematchBaseline: {
          source: 'market',
          complete: true,
          bestOf: 3,
          surface: 'clay',
          tourType: 'ATP',
          prematchFairProbA: 0.61,
          prematchFairProbB: 0.39,
          strengthBucketA: 'favorite',
          strengthBucketB: 'underdog',
          holdBaselineA: 0.82,
          holdBaselineB: 0.78,
          breakBaselineA: 0.24,
          breakBaselineB: 0.19,
        },
      },
    )

    expect(result.prematchBaseline?.source).toBe('market')
    expect(result.probabilityState.baseline.surface).toBe('clay')
    expect(result.probabilityState.pFair.anchor.prematchFairProbA).toBe(0.61)
    expect(result.probabilityState.pFair.point.source).toBe('derived')
    expect(result.probabilityState.pFair.game.source).toBe('derived')
    expect(result.probabilityState.pFair.set.source).toBe('derived')
    expect(result.probabilityState.pFair.match.source).toBe('derived')
    expect((result.probabilityState.pFair.match.pMatchA ?? 0) + (result.probabilityState.pFair.match.pMatchB ?? 0)).toBeCloseTo(1, 6)
    expect(result.decisionSnapshot.sourceCoverage.prematchBaselineAvailable).toBe(true)
    expect(result.decisionSnapshot.pFair.anchor.prematchFairProbA).toBe(0.61)
  })

  it('builds prematchBaseline from provider inputs when explicit baseline is not passed', async () => {
    const getPlayerBaseline = vi
      .fn()
      .mockResolvedValueOnce({
        source: 'atp',
        playerId: 'MED1',
        firstName: 'Daniil',
        lastName: 'Medvedev',
        nationality: 'Russia',
        age: 30,
        plays: 'Right-Handed',
        turnedPro: 2014,
        heightCm: 198,
        statYearFrom: 2018,
        statYearTo: 2026,
        category: 'Career',
        surface: 'ALL',
        rankDate: '2026-04-13T00:00:00',
        serve: {
          aces: 1200,
          doubleFaults: 400,
          firstServePercentage: 62,
          firstServePointsWonPercentage: 74,
          secondServePointsWonPercentage: 53,
          breakPointsFaced: 1000,
          breakPointsSavedPercentage: 66,
          serviceGamesPlayed: 3000,
          serviceGamesWonPercentage: 84,
          totalServicePointsWonPercentage: 66,
        },
        return: {
          firstServeReturnPointsWonPercentage: 33,
          secondServeReturnPointsWonPercentage: 54,
          breakPointsOpportunities: 1800,
          breakPointsConvertedPercentage: 41,
          returnGamesPlayed: 2900,
          returnGamesWonPercentage: 26,
          returnPointsWonPercentage: 41,
          totalPointsWonPercentage: 53,
        },
      })
      .mockResolvedValueOnce({
        source: 'atp',
        playerId: 'BER1',
        firstName: 'Matteo',
        lastName: 'Berrettini',
        nationality: 'Italy',
        age: 29,
        plays: 'Right-Handed',
        turnedPro: 2015,
        heightCm: 196,
        statYearFrom: 2018,
        statYearTo: 2026,
        category: 'Career',
        surface: 'ALL',
        rankDate: '2026-04-13T00:00:00',
        serve: {
          aces: 1500,
          doubleFaults: 500,
          firstServePercentage: 61,
          firstServePointsWonPercentage: 75,
          secondServePointsWonPercentage: 52,
          breakPointsFaced: 900,
          breakPointsSavedPercentage: 67,
          serviceGamesPlayed: 2800,
          serviceGamesWonPercentage: 86,
          totalServicePointsWonPercentage: 67,
        },
        return: {
          firstServeReturnPointsWonPercentage: 29,
          secondServeReturnPointsWonPercentage: 50,
          breakPointsOpportunities: 1500,
          breakPointsConvertedPercentage: 38,
          returnGamesPlayed: 2750,
          returnGamesWonPercentage: 22,
          returnPointsWonPercentage: 38,
          totalPointsWonPercentage: 51,
        },
      })

    const result = await extractMatchByUrl(
      'https://www.flashscore.com/match/tennis/foo/bar/?mid=abc',
      {
        playerDirectory: [
          {
            source: 'atp',
            sourcePlayerId: 'MED1',
            flashscorePlayerId: 'a1',
            fullName: 'Daniil Medvedev',
          },
          {
            source: 'atp',
            sourcePlayerId: 'BER1',
            flashscorePlayerId: 'b1',
            fullName: 'Matteo Berrettini',
          },
        ],
        atpClient: { getPlayerBaseline },
        marketImpliedProbA: 0.57,
        marketImpliedProbB: 0.49,
        surface: 'clay',
      },
    )

    expect(getPlayerBaseline).toHaveBeenNthCalledWith(1, 'MED1', { year: 'all', surface: 'all' })
    expect(getPlayerBaseline).toHaveBeenNthCalledWith(2, 'BER1', { year: 'all', surface: 'all' })
    expect(result.prematchBaseline?.source).toBe('market')
    expect(result.prematchBaseline?.surface).toBe('clay')
    expect(result.prematchBaseline?.holdBaselineA).toBe(0.84)
    expect(result.prematchBaseline?.holdBaselineB).toBe(0.86)
    expect(result.probabilityState.pFair.match.source).toBe('derived')
    expect(result.decisionSnapshot.prematchBaseline?.holdBaselineA).toBe(0.84)
  })
})
