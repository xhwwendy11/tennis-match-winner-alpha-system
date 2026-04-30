import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import type { CanonicalMatchState } from './canonicalMatchState.js'
import {
  buildResolvedMatchOutcome,
  buildResolvedOutcomeStoragePath,
  findResolvedOutcome,
  loadResolvedOutcomeIndex,
  writeResolvedMatchOutcome,
} from './resolvedOutcome.js'

function makeState(overrides: Partial<CanonicalMatchState> = {}): CanonicalMatchState {
  return {
    matchId: 'match-1',
    source: {
      sourceKind: 'flashscore',
      matchUrl: 'https://www.flashscore.com/match/tennis/a/b/',
      sourcePageUrl: null,
    },
    competition: {
      tournamentName: 'ATP Example',
      tournamentLabel: null,
      tournamentPath: null,
      round: 'Round of 32',
      bestOf: 3,
      tourType: 'ATP',
      gender: 'men',
      discipline: 'singles',
      startTimeISO: null,
    },
    participants: {
      teamA: { name: 'Player A', shortName: null, code: null, slug: 'player-a', playerId: 'a1' },
      teamB: { name: 'Player B', shortName: null, code: null, slug: 'player-b', playerId: 'b1' },
    },
    status: {
      matchStatus: 'FINAL',
      statusText: 'Finished',
      abnormalReason: 'none',
    },
    scoreboard: {
      setIndex: 2,
      setsWonA: 2,
      setsWonB: 0,
      currentSetGamesA: null,
      currentSetGamesB: null,
      currentGamePointsA: null,
      currentGamePointsB: null,
      isTiebreak: false,
    },
    serve: { raw: null, resolved: null, source: 'unknown', confidence: 'low', syncState: 'unknown' },
    quality: { matchIntegrity: 'ok' },
    stats: {
      acesA: null,
      acesB: null,
      firstServePercentageA: null,
      firstServePercentageB: null,
      pointsWonA: null,
      pointsWonB: null,
      firstServeWonA: null,
      firstServeWonB: null,
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
      serviceGamesWonA: null,
      serviceGamesWonB: null,
      returnGamesWonA: null,
      returnGamesWonB: null,
      breakPointsSavedA: null,
      breakPointsSavedB: null,
      breakPointsConvertedA: null,
      breakPointsConvertedB: null,
      breakPointsDisplayA: null,
      breakPointsDisplayB: null,
      doubleFaultsA: null,
      doubleFaultsB: null,
    },
    timestamps: {
      ingestedAt: '2026-04-22T20:00:00.000Z',
      scoreTimestamp: null,
      serveTimestamp: null,
      statsTimestamp: null,
    },
    ...overrides,
  }
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true })
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

describe('resolvedOutcome', () => {
  it('builds a high-confidence winner from final set score', () => {
    const outcome = buildResolvedMatchOutcome({ state: makeState(), resolvedAt: '2026-04-22T20:00:00.000Z' })

    expect(outcome.winner).toBe('teamA')
    expect(outcome.confidence).toBe('high')
    expect(buildResolvedOutcomeStoragePath(outcome)).toBe('data/outcomes/flashscore/2026/04/match-1__player-a-vs-player-b.json')
  })

  it('keeps non-final states unresolved', () => {
    const outcome = buildResolvedMatchOutcome({
      state: makeState({
        status: { matchStatus: 'LIVE', statusText: 'Live', abnormalReason: 'none' },
      }),
    })

    expect(outcome.winner).toBeNull()
    expect(outcome.confidence).toBe('low')
  })

  it('loads sidecar outcomes by match id and flashscore url', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'tennis-outcomes-'))
    const outcome = buildResolvedMatchOutcome({ state: makeState(), resolvedAt: '2026-04-22T20:00:00.000Z' })
    await writeResolvedMatchOutcome(outcome, root)
    await writeJson(path.join(root, 'bad.json'), { version: 'other' })

    const index = await loadResolvedOutcomeIndex(root)

    expect(findResolvedOutcome(index, { matchId: 'match-1' })?.winner).toBe('teamA')
    expect(findResolvedOutcome(index, { flashscoreMatchUrl: 'https://www.flashscore.com/match/tennis/a/b/' })?.winner).toBe('teamA')
  })
})
