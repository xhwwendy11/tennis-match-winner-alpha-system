import { describe, expect, it } from 'vitest'

import {
  buildKalshiMarketSnapshotFileName,
  buildKalshiMarketSnapshotStoragePath,
  buildSnapshotFileName,
  buildSnapshotStoragePath,
} from './snapshotDataset.js'

const snapshot = {
  version: 'decision-snapshot/v1',
  capturedAt: '2026-04-14T20:15:30.123Z',
  urls: {
    flashscoreMatchUrl: 'https://www.flashscore.com/match/tennis/foo/bar/',
    flashscoreSourcePageUrl: 'https://www.flashscore.com/match/tennis/foo/bar/?mid=abc',
    kalshiMarketUrl: 'https://kalshi.com/markets/example',
  },
  match: {
    matchId: 'EVT-123',
    tournamentName: 'ATP Monte Carlo',
    round: 'Round of 32',
    teamA: 'Daniil Medvedev',
    teamB: 'Matteo Berrettini',
    status: 'LIVE',
    abnormalReason: 'none',
    setIndex: 2,
    isTiebreak: false,
    setsWonA: 1,
    setsWonB: 0,
    currentSetGamesA: 4,
    currentSetGamesB: 3,
    currentGamePointsA: '30',
    currentGamePointsB: '30',
    serverSide: 'teamA',
    matchIntegrity: 'ok',
  },
  sourceCoverage: {
    flashscoreStatsAvailable: true,
    kalshiStatsAvailable: true,
    prematchBaselineAvailable: true,
    marketStateAvailable: true,
  },
  market: null,
  fairVsMarket: {
    available: false,
    marketTicker: null,
    marketStatus: null,
    fairProbA: 0.61,
    fairProbB: 0.39,
    marketProbA: { bid: null, ask: null, mid: null, last: null },
    marketProbB: { bid: null, ask: null, mid: null, last: null },
    edgeA: { vsBid: null, vsAsk: null, vsMid: null, vsLast: null },
    edgeB: { vsBid: null, vsAsk: null, vsMid: null, vsLast: null },
  },
  stats: {
    resolved: {
      acesA: { value: 6, source: 'kalshi_ui', confidence: 'high' },
      acesB: { value: 4, source: 'kalshi_ui', confidence: 'high' },
      doubleFaultsA: { value: 2, source: 'kalshi_ui', confidence: 'high' },
      doubleFaultsB: { value: 1, source: 'kalshi_ui', confidence: 'high' },
      pointsWonA: { value: 72, source: 'kalshi_ui', confidence: 'high' },
      pointsWonB: { value: 70, source: 'kalshi_ui', confidence: 'high' },
      firstServeWonA: { value: '36/48', source: 'kalshi_ui', confidence: 'high' },
      firstServeWonB: { value: '34/50', source: 'kalshi_ui', confidence: 'high' },
      secondServeWonA: { value: '15/28', source: 'kalshi_ui', confidence: 'high' },
      secondServeWonB: { value: '12/24', source: 'kalshi_ui', confidence: 'high' },
      serviceGamesWonA: { value: 7, source: 'kalshi_ui', confidence: 'high' },
      serviceGamesWonB: { value: 6, source: 'kalshi_ui', confidence: 'high' },
      breakPointsDisplayA: { value: '2/4', source: 'kalshi_ui', confidence: 'low' },
      breakPointsDisplayB: { value: '1/5', source: 'kalshi_ui', confidence: 'low' },
    },
    kalshiDisplay: null,
  },
  prematchBaseline: null,
  risk: {
    level: 'medium',
    machineCommand: 'WARN',
    matchedRule: '4-3, 30-30, leader serving',
    phase: 'non_tiebreak',
    stopTriggered: false,
  },
  pFair: {
    version: 'p-fair/v1',
    point: { serverSide: 'teamA', pPointA: 0.64, pPointB: 0.36, source: 'derived' },
    game: { serverSide: 'teamA', pGameA: 0.72, pGameB: 0.28, pHoldServer: 0.72, pBreakReceiver: 0.28, source: 'derived' },
    set: { pSetA: 0.66, pSetB: 0.34, source: 'derived' },
    match: { pMatchA: 0.58, pMatchB: 0.42, source: 'derived' },
    anchor: {
      prematchFairProbA: 0.61,
      prematchFairProbB: 0.39,
      holdBaselineA: 0.82,
      holdBaselineB: 0.78,
      breakBaselineA: 0.24,
      breakBaselineB: 0.19,
    },
    diagnostics: {
      setIndex: 2,
      isTiebreak: false,
      pointScoreA: '30',
      pointScoreB: '30',
      gameScoreA: 4,
      gameScoreB: 3,
      riskRule: '4-3, 30-30, leader serving',
      integrity: 'ok',
      statsAdjustmentA: 0.01,
      statsAdjustmentB: -0.01,
    },
  },
  tradePlan: {
    tradeMode: 'maker_reversion_light',
    jumpPhase: true,
    exposureAllowed: true,
    preferredSide: 'extreme_low_price_side',
    summary: 'jump',
  },
} as const

describe('snapshotDataset', () => {
  it('builds a stable snapshot filename', () => {
    expect(buildSnapshotFileName(snapshot)).toBe(
      '2026-04-14t20-15-30-123z__evt-123__daniil-medvedev-vs-matteo-berrettini.json',
    )
  })

  it('builds a dated storage path', () => {
    expect(buildSnapshotStoragePath(snapshot)).toBe(
      'snapshots/2026/04/14/2026-04-14t20-15-30-123z__evt-123__daniil-medvedev-vs-matteo-berrettini.json',
    )
  })

  it('builds a dated Kalshi market snapshot path', () => {
    const marketSnapshot = {
      version: 'kalshi-market-snapshot/v1',
      capturedAt: '2026-04-14T20:15:30.123Z',
      sourceUrl: 'https://kalshi.com/markets/example',
      eventTicker: 'KXATP-123',
      marketTicker: 'KXATP-123-MED',
      marketTitle: 'Medvedev vs Berrettini',
      marketStatus: 'OPEN',
      prices: {
        yesBid: 57,
        yesAsk: 59,
        noBid: 41,
        noAsk: 43,
        lastPrice: 58,
        yesMid: 0.58,
        noMid: 0.42,
        spread: 0.02,
      },
      orderbook: {
        yes: [],
        no: [],
      },
      trades: {
        items: [],
        cursor: null,
      },
      liquidity: { volume: 150000 },
      timestamps: { marketTimestamp: '2026-04-14T20:15:00.000Z' },
    } as const

    expect(buildKalshiMarketSnapshotFileName(marketSnapshot)).toBe(
      '2026-04-14t20-15-30-123z__kxatp-123-med.json',
    )
    expect(buildKalshiMarketSnapshotStoragePath(marketSnapshot)).toBe(
      'market-snapshots/kalshi/2026/04/14/2026-04-14t20-15-30-123z__kxatp-123-med.json',
    )
  })
})
