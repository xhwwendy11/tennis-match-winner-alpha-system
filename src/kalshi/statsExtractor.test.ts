import { describe, expect, it } from 'vitest'

import { parseCanonicalKalshiMarketStateFromText, parseKalshiDisplayStatsFromText } from './statsExtractor.js'

describe('parseKalshiDisplayStatsFromText', () => {
  it('extracts the displayed tennis stats block from page text', () => {
    const text = [
      '100%',
      'Duckworth',
      'Napolitano',
      '8',
      'Aces',
      '4',
      '5',
      'Double faults',
      '3',
      '19',
      'Games won',
      '15',
      '121',
      'Points won',
      '110',
      '48/62',
      '1st serve won',
      '43/65',
      '34/57',
      '2nd serve won',
      '25/40',
      '14',
      'Service games won',
      '12',
      '2/7',
      'Break points',
      '1/12',
    ].join('\n')

    expect(parseKalshiDisplayStatsFromText(text)).toEqual({
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
    })
  })
})

describe('parseCanonicalKalshiMarketStateFromText', () => {
  it('extracts a minimal market state from Kalshi page text', () => {
    const text = [
      'Sports',
      '·',
      'Tennis',
      '·',
      'ATP Challenger Tallahassee · Round Of 16',
      'Rybakov vs Boscardin Dias',
      '19',
      'LIVE',
      '$3,641,128 vol',
      'Chance',
      'Pedro Boscardin Dias',
      '68%',
      '▲ 15',
      'Yes 76¢',
      'No 33¢',
      'Event',
      'KXATPCHALLENGERMATCH-26APR15RYBBOS',
      'Market',
      'KXATPCHALLENGERMATCH-26APR15RYBBOS-BOS',
    ].join('\n')

    const state = parseCanonicalKalshiMarketStateFromText(text)

    expect(state).toEqual({
      provider: 'kalshi',
      eventTicker: 'KXATPCHALLENGERMATCH-26APR15RYBBOS',
      marketTicker: 'KXATPCHALLENGERMATCH-26APR15RYBBOS-BOS',
      marketTitle: 'Rybakov vs Boscardin Dias',
      marketStatus: 'OPEN',
      prices: {
        yesBid: null,
        yesAsk: 76,
        noBid: null,
        noAsk: 33,
        lastPrice: 68,
      },
      liquidity: {
        volume: 3641128,
      },
      timestamps: {
        marketTimestamp: expect.any(String),
      },
    })
  })
})
