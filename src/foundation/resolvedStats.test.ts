import { describe, expect, it } from 'vitest'

import { buildResolvedStats } from './resolvedStats.js'

describe('buildResolvedStats', () => {
  it('prefers Kalshi display stats for overlapping fields and falls back to Flashscore', () => {
    const resolved = buildResolvedStats({
      kalshi: {
        acesA: 8,
        acesB: 4,
        doubleFaultsA: 5,
        doubleFaultsB: 3,
        pointsWonA: 121,
        pointsWonB: 110,
        firstServeWonA: '48/62',
        firstServeWonB: '43/65',
        secondServeWonA: '34/57',
        secondServeWonB: '25/40',
        serviceGamesWonA: 14,
        serviceGamesWonB: 12,
        breakPointsDisplayA: '2/7',
        breakPointsDisplayB: '1/12',
      },
      flashscore: {
        acesA: 8,
        acesB: 4,
        doubleFaultsA: 5,
        doubleFaultsB: 3,
        firstServePercentageA: '50%',
        firstServePercentageB: '61%',
        firstServeWonA: '77% (48/62)',
        firstServeWonB: '68% (44/65)',
        secondServeWonA: '55% (34/62)',
        secondServeWonB: '57% (24/42)',
        servicePointsWonA: '66% (82/124)',
        servicePointsWonB: '63% (68/107)',
        firstServeReturnPointsWonA: '34% (22/65)',
        firstServeReturnPointsWonB: '23% (14/62)',
        secondServeReturnPointsWonA: '43% (18/42)',
        secondServeReturnPointsWonB: '45% (28/62)',
        returnPointsWonA: '37% (40/107)',
        returnPointsWonB: '34% (42/124)',
        breakPointsSavedA: '11/13',
        breakPointsSavedB: '5/9',
        breakPointsConvertedA: '4/9',
        breakPointsConvertedB: '2/13',
        serviceGamesPlayedA: null,
        serviceGamesPlayedB: null,
        returnGamesPlayedA: null,
        returnGamesPlayedB: null,
        returnGamesWonA: '43% (6/14)',
        returnGamesWonB: '36% (4/11)',
        pointsWonA: 121,
        pointsWonB: 109,
        serviceGamesWonA: 14,
        serviceGamesWonB: 12,
        breakPointsDisplayA: '4/9',
        breakPointsDisplayB: '2/13',
      },
    })

    expect(resolved.acesA).toEqual({ value: 8, source: 'kalshi_ui', confidence: 'high' })
    expect(resolved.firstServePercentageA).toEqual({ value: '50%', source: 'flashscore', confidence: 'medium' })
    expect(resolved.pointsWonB).toEqual({ value: 110, source: 'kalshi_ui', confidence: 'high' })
    expect(resolved.servicePointsWonA).toEqual({ value: '66% (82/124)', source: 'flashscore', confidence: 'medium' })
    expect(resolved.firstServeReturnPointsWonB).toEqual({ value: '23% (14/62)', source: 'flashscore', confidence: 'medium' })
    expect(resolved.returnPointsWonA).toEqual({ value: '37% (40/107)', source: 'flashscore', confidence: 'medium' })
    expect(resolved.breakPointsSavedA).toEqual({ value: '11/13', source: 'flashscore', confidence: 'medium' })
    expect(resolved.breakPointsConvertedB).toEqual({ value: '2/13', source: 'flashscore', confidence: 'medium' })
    expect(resolved.returnGamesWonB).toEqual({ value: '36% (4/11)', source: 'flashscore', confidence: 'medium' })
    expect(resolved.breakPointsDisplayA).toEqual({ value: '2/7', source: 'kalshi_ui', confidence: 'low' })
  })

  it('falls back to Flashscore when Kalshi is missing', () => {
    const resolved = buildResolvedStats({
      kalshi: null,
      flashscore: {
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
        servicePointsWonA: '64% (51/80)',
        servicePointsWonB: '61% (60/98)',
        firstServeReturnPointsWonA: '34% (29/85)',
        firstServeReturnPointsWonB: '31% (16/52)',
        secondServeReturnPointsWonA: '69% (9/13)',
        secondServeReturnPointsWonB: '46% (13/28)',
        returnPointsWonA: '41% (38/93)',
        returnPointsWonB: '35% (29/80)',
        breakPointsSavedA: '3/5',
        breakPointsSavedB: '9/10',
        breakPointsConvertedA: '1/10',
        breakPointsConvertedB: '2/10',
        serviceGamesPlayedA: null,
        serviceGamesPlayedB: null,
        returnGamesPlayedA: null,
        returnGamesPlayedB: null,
        returnGamesWonA: '11% (1/9)',
        returnGamesWonB: '20% (2/10)',
        pointsWonA: 57,
        pointsWonB: 79,
        serviceGamesWonA: 8,
        serviceGamesWonB: 9,
        breakPointsDisplayA: '1/10',
        breakPointsDisplayB: '2/10',
      },
    })

    expect(resolved.doubleFaultsB).toEqual({ value: 0, source: 'flashscore', confidence: 'medium' })
    expect(resolved.firstServePercentageB).toEqual({ value: '87%', source: 'flashscore', confidence: 'medium' })
    expect(resolved.servicePointsWonA).toEqual({ value: '64% (51/80)', source: 'flashscore', confidence: 'medium' })
    expect(resolved.returnGamesWonB).toEqual({ value: '20% (2/10)', source: 'flashscore', confidence: 'medium' })
    expect(resolved.breakPointsSavedB).toEqual({ value: '9/10', source: 'flashscore', confidence: 'medium' })
    expect(resolved.breakPointsDisplayB).toEqual({ value: '2/10', source: 'flashscore', confidence: 'medium' })
  })
})
