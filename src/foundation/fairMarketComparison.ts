import type { CanonicalMarketState } from './canonicalMarketState.js'
import type { CanonicalMatchState } from './canonicalMatchState.js'
import type { PFairState } from '../pfair/types.js'

export type MarketYesSide = 'teamA' | 'teamB' | 'unknown'

export interface FairMarketComparison {
  available: boolean
  marketTicker: string | null
  marketStatus: CanonicalMarketState['marketStatus'] | null
  marketYesSide: MarketYesSide
  fairProbA: number | null
  fairProbB: number | null
  marketProbA: {
    bid: number | null
    ask: number | null
    mid: number | null
    last: number | null
  }
  marketProbB: {
    bid: number | null
    ask: number | null
    mid: number | null
    last: number | null
  }
  edgeA: {
    vsBid: number | null
    vsAsk: number | null
    vsMid: number | null
    vsLast: number | null
  }
  edgeB: {
    vsBid: number | null
    vsAsk: number | null
    vsMid: number | null
    vsLast: number | null
  }
}

function centsToProb(value: number | null | undefined): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return value / 100
}

function midpoint(a: number | null, b: number | null): number | null {
  if (a == null || b == null) return null
  return (a + b) / 2
}

function diff(a: number | null, b: number | null): number | null {
  if (a == null || b == null) return null
  return a - b
}

function normalize(value: string | null | undefined): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function compact(value: string | null | undefined): string {
  return normalize(value).replace(/\s+/g, '')
}

function tickerSuffix(ticker: string | null | undefined): string | null {
  const suffix = String(ticker || '').split('-').filter(Boolean).pop()
  const normalized = compact(suffix)
  return normalized || null
}

function playerCodes(player: CanonicalMatchState['participants']['teamA'] | null | undefined): Set<string> {
  const values = [player?.name, player?.shortName, player?.code, player?.slug].map(normalize).filter(Boolean)
  const codes = new Set<string>()

  for (const value of values) {
    const tokens = value.split(/\s+/).filter(Boolean)
    const compacted = value.replace(/\s+/g, '')
    if (compacted) codes.add(compacted)
    for (const token of tokens) {
      codes.add(token)
      if (token.length >= 3) codes.add(token.slice(0, 3))
    }
  }

  return codes
}

function matchesPlayerText(text: string, player: CanonicalMatchState['participants']['teamA'] | null | undefined): boolean {
  const normalized = compact(text)
  if (!normalized) return false
  return playerCodes(player).has(normalized)
}

export function resolveMarketYesSide(input: {
  marketState: CanonicalMarketState | null
  matchState?: CanonicalMatchState | null
}): MarketYesSide {
  const match = input.matchState
  if (!match) return 'teamA'

  const suffix = tickerSuffix(input.marketState?.marketTicker)
  if (suffix) {
    const sideA = playerCodes(match.participants.teamA).has(suffix)
    const sideB = playerCodes(match.participants.teamB).has(suffix)
    if (sideA && !sideB) return 'teamA'
    if (sideB && !sideA) return 'teamB'
  }

  const titleParts = String(input.marketState?.marketTitle || '').split(/\s+vs\.?\s+/i)
  if (titleParts.length >= 2) {
    const first = titleParts[0]
    const second = titleParts[1]
    if (matchesPlayerText(first, match.participants.teamA) && matchesPlayerText(second, match.participants.teamB)) {
      return 'teamA'
    }
    if (matchesPlayerText(first, match.participants.teamB) && matchesPlayerText(second, match.participants.teamA)) {
      return 'teamB'
    }
  }

  const willBeatMatch = String(input.marketState?.marketTitle || '').match(/will\s+(.+?)\s+beat\s+(.+?)(?:\?|$)/i)
  if (willBeatMatch) {
    const first = willBeatMatch[1]
    const second = willBeatMatch[2]
    if (matchesPlayerText(first, match.participants.teamA) && matchesPlayerText(second, match.participants.teamB)) {
      return 'teamA'
    }
    if (matchesPlayerText(first, match.participants.teamB) && matchesPlayerText(second, match.participants.teamA)) {
      return 'teamB'
    }
  }

  return 'unknown'
}

export function buildFairMarketComparison(input: {
  pFair: PFairState
  marketState: CanonicalMarketState | null
  matchState?: CanonicalMatchState | null
}): FairMarketComparison {
  const market = input.marketState
  const fairProbA = input.pFair.match.pMatchA
  const fairProbB = input.pFair.match.pMatchB
  const marketYesSide = resolveMarketYesSide({ marketState: market, matchState: input.matchState })

  const yesBid = centsToProb(market?.prices.yesBid)
  const yesAsk = centsToProb(market?.prices.yesAsk)
  const yesLast = centsToProb(market?.prices.lastPrice)
  const yesMid = midpoint(yesBid, yesAsk)

  const noBid = centsToProb(market?.prices.noBid)
  const noAsk = centsToProb(market?.prices.noAsk)
  const noMid = midpoint(noBid, noAsk)
  const lastA =
    marketYesSide === 'teamA'
      ? yesLast
      : marketYesSide === 'teamB' && yesLast != null
        ? 1 - yesLast
        : null
  const lastB =
    marketYesSide === 'teamA' && yesLast != null
      ? 1 - yesLast
      : marketYesSide === 'teamB'
        ? yesLast
        : null
  const marketProbA =
    marketYesSide === 'teamA'
      ? { bid: yesBid, ask: yesAsk, mid: yesMid, last: lastA }
      : marketYesSide === 'teamB'
        ? { bid: noBid, ask: noAsk, mid: noMid, last: lastA }
        : { bid: null, ask: null, mid: null, last: null }
  const marketProbB =
    marketYesSide === 'teamA'
      ? { bid: noBid, ask: noAsk, mid: noMid, last: lastB }
      : marketYesSide === 'teamB'
        ? { bid: yesBid, ask: yesAsk, mid: yesMid, last: lastB }
        : { bid: null, ask: null, mid: null, last: null }

  return {
    available: !!market && marketYesSide !== 'unknown' && fairProbA != null && fairProbB != null,
    marketTicker: market?.marketTicker ?? null,
    marketStatus: market?.marketStatus ?? null,
    marketYesSide,
    fairProbA,
    fairProbB,
    marketProbA,
    marketProbB,
    edgeA: {
      vsBid: diff(fairProbA, marketProbA.bid),
      vsAsk: diff(fairProbA, marketProbA.ask),
      vsMid: diff(fairProbA, marketProbA.mid),
      vsLast: diff(fairProbA, marketProbA.last),
    },
    edgeB: {
      vsBid: diff(fairProbB, marketProbB.bid),
      vsAsk: diff(fairProbB, marketProbB.ask),
      vsMid: diff(fairProbB, marketProbB.mid),
      vsLast: diff(fairProbB, marketProbB.last),
    },
  }
}
