import { describe, expect, it } from 'vitest'

import { parseTennisStats } from './scoreboardClient.js'

describe('parseTennisStats', () => {
  it('maps aggregate match stats from the tennis detail feed', () => {
    const payload = [
      'SE÷Match',
      'SF÷Service',
      'SG÷Aces¬SH÷8¬SI÷4',
      'SG÷Double Faults¬SH÷5¬SI÷3',
      'SG÷1st serve points won¬SH÷75% (50/67)¬SI÷70% (43/61)',
      'SG÷2nd serve points won¬SH÷54% (33/61)¬SI÷57% (23/40)',
      'SG÷Break Points Saved¬SH÷11/13¬SI÷4/7',
      'SG÷Break Points Converted¬SH÷3/7¬SI÷2/13',
      'SG÷Total Points Won¬SH÷52% (116/224)¬SI÷48% (108/224)',
      'SG÷Service games won¬SH÷87% (13/15)¬SI÷80% (12/15)',
      'SG÷Return games won¬SH÷20% (3/15)¬SI÷13% (2/15)',
    ].join('¬~')

    const stats = parseTennisStats(payload)

    expect(stats).toEqual({
      acesA: 8,
      acesB: 4,
      doubleFaultsA: 5,
      doubleFaultsB: 3,
      firstServePercentageA: null,
      firstServePercentageB: null,
      firstServeWonA: '75% (50/67)',
      firstServeWonB: '70% (43/61)',
      secondServeWonA: '54% (33/61)',
      secondServeWonB: '57% (23/40)',
      servicePointsWonA: '65% (83/128)',
      servicePointsWonB: '65% (66/101)',
      firstServeReturnPointsWonA: null,
      firstServeReturnPointsWonB: null,
      secondServeReturnPointsWonA: null,
      secondServeReturnPointsWonB: null,
      returnPointsWonA: null,
      returnPointsWonB: null,
      breakPointsSavedA: '11/13',
      breakPointsSavedB: '4/7',
      breakPointsConvertedA: '3/7',
      breakPointsConvertedB: '2/13',
      serviceGamesPlayedA: '87% (13/15)',
      serviceGamesPlayedB: '80% (12/15)',
      returnGamesPlayedA: '20% (3/15)',
      returnGamesPlayedB: '13% (2/15)',
      returnGamesWonA: '20% (3/15)',
      returnGamesWonB: '13% (2/15)',
      pointsWonA: 116,
      pointsWonB: 108,
      serviceGamesWonA: 13,
      serviceGamesWonB: 12,
      breakPointsDisplayA: '3/7',
      breakPointsDisplayB: '2/13',
    })
  })
})
