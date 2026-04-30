import { describe, expect, it } from 'vitest'

import { resolveServingSideFromSnapshot } from './serverExtractor.js'

describe('resolveServingSideFromSnapshot', () => {
  it('detects home server from participant serve icon', () => {
    expect(
      resolveServingSideFromSnapshot({
        homeParticipantServe: true,
        awayParticipantServe: false,
        homeScoreboardServe: false,
        awayScoreboardServe: false,
        homeFixedHeaderServe: false,
        awayFixedHeaderServe: false,
        homeName: 'Coria F.',
        awayName: 'Bueno G.',
      }),
    ).toEqual({
      serverSide: 'teamA',
      serverPlayerName: 'Coria F.',
    })
  })

  it('detects away server from scoreboard serve icon when participant marker is absent', () => {
    expect(
      resolveServingSideFromSnapshot({
        homeParticipantServe: false,
        awayParticipantServe: false,
        homeScoreboardServe: false,
        awayScoreboardServe: true,
        homeFixedHeaderServe: false,
        awayFixedHeaderServe: false,
        homeName: 'Coria F.',
        awayName: 'Bueno G.',
      }),
    ).toEqual({
      serverSide: 'teamB',
      serverPlayerName: 'Bueno G.',
    })
  })

  it('returns null when both sides appear served or neither side is served', () => {
    expect(
      resolveServingSideFromSnapshot({
        homeParticipantServe: false,
        awayParticipantServe: false,
        homeScoreboardServe: false,
        awayScoreboardServe: false,
        homeFixedHeaderServe: false,
        awayFixedHeaderServe: false,
        homeName: 'Coria F.',
        awayName: 'Bueno G.',
      }),
    ).toBeNull()

    expect(
      resolveServingSideFromSnapshot({
        homeParticipantServe: true,
        awayParticipantServe: true,
        homeScoreboardServe: false,
        awayScoreboardServe: false,
        homeFixedHeaderServe: false,
        awayFixedHeaderServe: false,
        homeName: 'Coria F.',
        awayName: 'Bueno G.',
      }),
    ).toBeNull()
  })
})
