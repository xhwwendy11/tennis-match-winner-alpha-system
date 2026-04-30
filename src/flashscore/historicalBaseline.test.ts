import { beforeEach, describe, expect, it, vi } from 'vitest'

import { buildFlashscoreHistoricalPlayerBaseline } from './historicalBaseline.js'
import { fetchDirectMatchPage, fetchPlayerResultsMatches } from '../realtime-score/tennis/scoreboardClient.js'
import type { TennisFeedMatch } from '../realtime-score/tennis/types.js'

vi.mock('../realtime-score/tennis/scoreboardClient.js', () => ({
  fetchPlayerResultsMatches: vi.fn(),
  fetchDirectMatchPage: vi.fn(),
}))

function makeMatch(overrides: Partial<TennisFeedMatch> = {}): TennisFeedMatch {
  return {
    eventId: 'm1',
    tournamentName: 'Savannah',
    tournamentPath: 'https://www.flashscore.com/tennis/challenger-men-singles/savannah/',
    tournamentLabel: 'Challenger Men - Singles',
    round: '1/16-finals',
    startTimeISO: '2026-04-21T18:00:00Z',
    status: 'FINAL',
    statusText: 'Finished',
    teamA: {
      name: 'Andrew Johnson',
      shortName: 'Johnson A.',
      code: 'JOH',
      slug: 'johnson-andrew',
      playerId: 'I18JMi8s',
      score: 1,
    },
    teamB: {
      name: 'Nishesh Basavareddy',
      shortName: 'Basavareddy N.',
      code: 'BAS',
      slug: 'basavareddy-nishesh',
      playerId: 'rqtJueQt',
      score: 2,
    },
    currentSet: null,
    currentGame: null,
    serverSide: null,
    serverSideResolved: null,
    serverSideSource: 'unknown',
    serveConfidence: 'low',
    serverPlayerName: null,
    stats: null,
    sets: [],
    matchUrl: 'https://www.flashscore.com/match/tennis/basavareddy-nishesh-rqtJueQt/johnson-andrew-I18JMi8s/',
    sourcePageUrl: 'https://www.flashscore.com/player/basavareddy-nishesh/rqtJueQt/results/',
    ...overrides,
  }
}

describe('buildFlashscoreHistoricalPlayerBaseline', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('aggregates recent singles match stats into serve and return baselines', async () => {
    vi.mocked(fetchPlayerResultsMatches).mockResolvedValue([
      makeMatch({ eventId: 'm1' }),
      makeMatch({ eventId: 'm2' }),
      makeMatch({
        eventId: 'doubles',
        tournamentPath: 'https://www.flashscore.com/tennis/challenger-men-doubles/savannah/',
        teamA: {
          name: 'A/B',
          shortName: 'A/B',
          code: 'AB',
          slug: 'a',
          playerId: 'a',
          score: 0,
        },
      }),
    ])
    vi.mocked(fetchDirectMatchPage)
      .mockResolvedValueOnce([
        makeMatch({
          eventId: 'm1',
          stats: {
            acesA: null,
            acesB: null,
            doubleFaultsA: null,
            doubleFaultsB: null,
            firstServePercentageA: null,
            firstServePercentageB: '60% (60/100)',
            firstServeWonA: null,
            firstServeWonB: '70% (42/60)',
            secondServeWonA: null,
            secondServeWonB: '50% (20/40)',
            servicePointsWonA: null,
            servicePointsWonB: '62% (62/100)',
            firstServeReturnPointsWonA: null,
            firstServeReturnPointsWonB: '30% (18/60)',
            secondServeReturnPointsWonA: null,
            secondServeReturnPointsWonB: '55% (22/40)',
            returnPointsWonA: null,
            returnPointsWonB: '40% (40/100)',
            breakPointsSavedA: null,
            breakPointsSavedB: null,
            breakPointsConvertedA: null,
            breakPointsConvertedB: null,
            serviceGamesPlayedA: null,
            serviceGamesPlayedB: '80% (8/10)',
            returnGamesPlayedA: null,
            returnGamesPlayedB: '30% (3/10)',
            returnGamesWonA: null,
            returnGamesWonB: '30% (3/10)',
            pointsWonA: null,
            pointsWonB: null,
            serviceGamesWonA: null,
            serviceGamesWonB: 8,
            breakPointsDisplayA: null,
            breakPointsDisplayB: null,
          },
        }),
      ])
      .mockResolvedValueOnce([
        makeMatch({
          eventId: 'm2',
          stats: {
            acesA: null,
            acesB: null,
            doubleFaultsA: null,
            doubleFaultsB: null,
            firstServePercentageA: null,
            firstServePercentageB: '50% (40/80)',
            firstServeWonA: null,
            firstServeWonB: '75% (30/40)',
            secondServeWonA: null,
            secondServeWonB: '50% (20/40)',
            servicePointsWonA: null,
            servicePointsWonB: '63% (50/80)',
            firstServeReturnPointsWonA: null,
            firstServeReturnPointsWonB: '25% (10/40)',
            secondServeReturnPointsWonA: null,
            secondServeReturnPointsWonB: '50% (20/40)',
            returnPointsWonA: null,
            returnPointsWonB: '38% (30/80)',
            breakPointsSavedA: null,
            breakPointsSavedB: null,
            breakPointsConvertedA: null,
            breakPointsConvertedB: null,
            serviceGamesPlayedA: null,
            serviceGamesPlayedB: '75% (6/8)',
            returnGamesPlayedA: null,
            returnGamesPlayedB: '25% (2/8)',
            returnGamesWonA: null,
            returnGamesWonB: '25% (2/8)',
            pointsWonA: null,
            pointsWonB: null,
            serviceGamesWonA: null,
            serviceGamesWonB: 6,
            breakPointsDisplayA: null,
            breakPointsDisplayB: null,
          },
        }),
      ])

    const baseline = await buildFlashscoreHistoricalPlayerBaseline(
      {
        name: 'Nishesh Basavareddy',
        slug: 'basavareddy-nishesh',
        playerId: 'rqtJueQt',
      },
      { minStatMatches: 2 },
    )

    expect(baseline?.source).toBe('flashscore_history')
    expect(baseline?.sampleMatches).toBe(2)
    expect(baseline?.serve.serviceGamesPlayed).toBe(18)
    expect(baseline?.serve.serviceGamesWonPercentage).toBeCloseTo(77.78, 2)
    expect(baseline?.return.returnGamesWonPercentage).toBeCloseTo(27.78, 2)
    expect(fetchDirectMatchPage).toHaveBeenCalledTimes(2)
    expect(fetchDirectMatchPage).toHaveBeenCalledWith(
      'https://www.flashscore.com/match/tennis/basavareddy-nishesh-rqtJueQt/johnson-andrew-I18JMi8s/',
      { force: undefined, includeRenderedServe: false },
    )
  })

  it('stops fetching match details once the minimum stat sample is reached', async () => {
    vi.mocked(fetchPlayerResultsMatches).mockResolvedValue([
      makeMatch({ eventId: 'm1', matchUrl: 'https://www.flashscore.com/match/tennis/one/' }),
      makeMatch({ eventId: 'm2', matchUrl: 'https://www.flashscore.com/match/tennis/two/' }),
      makeMatch({ eventId: 'm3', matchUrl: 'https://www.flashscore.com/match/tennis/three/' }),
    ])
    vi.mocked(fetchDirectMatchPage).mockResolvedValue([
      makeMatch({
        eventId: 'm1',
        stats: {
          acesA: null,
          acesB: null,
          doubleFaultsA: null,
          doubleFaultsB: null,
          firstServePercentageA: null,
          firstServePercentageB: '60% (60/100)',
          firstServeWonA: null,
          firstServeWonB: '70% (42/60)',
          secondServeWonA: null,
          secondServeWonB: null,
          servicePointsWonA: null,
          servicePointsWonB: null,
          firstServeReturnPointsWonA: null,
          firstServeReturnPointsWonB: null,
          secondServeReturnPointsWonA: null,
          secondServeReturnPointsWonB: null,
          returnPointsWonA: null,
          returnPointsWonB: null,
          breakPointsSavedA: null,
          breakPointsSavedB: null,
          breakPointsConvertedA: null,
          breakPointsConvertedB: null,
          serviceGamesPlayedA: null,
          serviceGamesPlayedB: null,
          returnGamesPlayedA: null,
          returnGamesPlayedB: null,
          returnGamesWonA: null,
          returnGamesWonB: null,
          pointsWonA: null,
          pointsWonB: null,
          serviceGamesWonA: null,
          serviceGamesWonB: null,
          breakPointsDisplayA: null,
          breakPointsDisplayB: null,
        },
      }),
    ])

    const baseline = await buildFlashscoreHistoricalPlayerBaseline(
      {
        name: 'Nishesh Basavareddy',
        slug: 'basavareddy-nishesh',
        playerId: 'rqtJueQt',
      },
      { minStatMatches: 1, maxMatches: 3 },
    )

    expect(baseline?.sampleMatches).toBe(1)
    expect(fetchDirectMatchPage).toHaveBeenCalledTimes(1)
  })
})
