import { describe, expect, it } from 'vitest'

import {
  filterPolymarketTennisMarkets,
  inferPolymarketPlayers,
  inferPolymarketWinner,
  isPolymarketTennisMarket,
  normalizePolymarketMarket,
  normalizePolymarketTrade,
  parsePolymarketOutcomePrices,
} from './historicalData.js'

describe('polymarket historical data normalization', () => {
  it('parses outcome prices and settled winner', () => {
    expect(parsePolymarketOutcomePrices('["0.99","0.01"]')).toEqual([0.99, 0.01])
    expect(parsePolymarketOutcomePrices("['0', '1']")).toEqual([0, 1])
    expect(inferPolymarketWinner({ closed: true, outcomePrices: [0.99, 0.01] })).toBe('token1')
    expect(inferPolymarketWinner({ closed: true, outcomePrices: [0.01, 0.99] })).toBe('token2')
    expect(inferPolymarketWinner({ closed: false, outcomePrices: [0.99, 0.01] })).toBe('unknown')
  })

  it('detects tennis markets and extracts player names', () => {
    const row = {
      id: 'pm-1',
      question: 'Will Carlos Alcaraz beat Jannik Sinner?',
      event_title: 'ATP Tennis',
      slug: 'will-alcaraz-beat-sinner',
      outcome_prices: '["0.99","0.01"]',
      closed: 1,
      active: 0,
      archived: 1,
      answer1: 'Yes',
      answer2: 'No',
      volume: '1250.5',
    }

    expect(isPolymarketTennisMarket(row)).toBe(true)
    expect(inferPolymarketPlayers(row)).toEqual({ playerA: 'Carlos Alcaraz', playerB: 'Jannik Sinner' })
    expect(normalizePolymarketMarket(row)).toMatchObject({
      sport: 'tennis',
      marketKind: 'match_winner',
      competitionHint: 'ATP/ITF men',
      winner: 'token1',
      volume: 1250.5,
    })
  })

  it('strips tournament prefixes from match winner markets', () => {
    expect(
      normalizePolymarketMarket({
        question: "Australian Open Men's: Carlos Alcaraz vs Novak Djokovic",
        outcome_prices: "['0', '1']",
        closed: 1,
      }),
    ).toMatchObject({
      marketKind: 'match_winner',
      playerA: 'Carlos Alcaraz',
      playerB: 'Novak Djokovic',
      winner: 'token2',
    })
  })

  it('classifies outrights and handicaps separately from match winners', () => {
    expect(normalizePolymarketMarket({ question: 'Will Jannik Sinner win the 2025 US Open?' }).marketKind).toBe('outright')
    expect(normalizePolymarketMarket({ question: 'Set Handicap: Cirstea (-1.5) vs Noskova (+1.5)' }).marketKind).toBe('handicap')
  })

  it('filters non-tennis markets', () => {
    const markets = filterPolymarketTennisMarkets([
      { id: 'tennis', question: 'Will Iga Swiatek beat Coco Gauff?', event_title: 'WTA Tennis' },
      { id: 'macro', question: 'Will CPI be above 3%?' },
    ])

    expect(markets).toHaveLength(1)
    expect(markets[0]?.id).toBe('tennis')
  })

  it('normalizes quant/trades rows into a stable trade shape', () => {
    expect(
      normalizePolymarketTrade({
        timestamp: '1710000000',
        market_id: 'm1',
        condition_id: 'c1',
        event_id: 'e1',
        price: '0.62',
        usd_amount: '120.5',
        token_amount: '194.35',
        side: 'BUY',
        nonusdc_side: 'token1',
        transaction_hash: '0xabc',
        log_index: '7',
      }),
    ).toEqual({
      source: 'polymarket',
      timestamp: 1710000000,
      marketId: 'm1',
      conditionId: 'c1',
      eventId: 'e1',
      price: 0.62,
      usdAmount: 120.5,
      tokenAmount: 194.35,
      side: 'BUY',
      tokenSide: 'token1',
      transactionHash: '0xabc',
      logIndex: 7,
    })
  })
})
