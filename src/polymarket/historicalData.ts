import type {
  NormalizedPolymarketMarket,
  NormalizedPolymarketTrade,
  PolymarketOutcomeWinner,
  PolymarketTennisMarketKind,
  RawPolymarketMarketRow,
  RawPolymarketTradeRow,
} from './types.js'

function text(value: unknown): string | null {
  const normalized = String(value ?? '').trim()
  return normalized || null
}

function lowerText(...values: Array<unknown>): string {
  return values.map((value) => String(value ?? '')).join(' ').toLowerCase()
}

function bool(value: unknown): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0
  const normalized = String(value ?? '').trim().toLowerCase()
  return normalized === '1' || normalized === 'true' || normalized === 'yes'
}

function numberOrNull(value: unknown): number | null {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function parsePolymarketOutcomePrices(value: RawPolymarketMarketRow['outcome_prices']): [number, number] | null {
  let parsed: unknown = value
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value)
    } catch {
      try {
        parsed = JSON.parse(value.replace(/'/g, '"'))
      } catch {
        return null
      }
    }
  }
  if (!Array.isArray(parsed) || parsed.length < 2) return null
  const first = numberOrNull(parsed[0])
  const second = numberOrNull(parsed[1])
  if (first == null || second == null) return null
  return [first, second]
}

export function inferPolymarketWinner(input: {
  closed: boolean
  outcomePrices: [number, number] | null
}): PolymarketOutcomeWinner {
  if (!input.closed || !input.outcomePrices) return 'unknown'
  const [token1, token2] = input.outcomePrices
  if (token1 >= 0.98 && token2 <= 0.02) return 'token1'
  if (token2 >= 0.98 && token1 <= 0.02) return 'token2'
  return 'unknown'
}

export function inferPolymarketCompetitionHint(row: RawPolymarketMarketRow): string | null {
  const combined = lowerText(row.question, row.slug, row.event_title, row.event_slug)
  if (/\bwta\b|women'?s tennis|itf women|wimbledon women|us open women|australian open women|french open women/.test(combined)) {
    return 'WTA/ITF women'
  }
  if (/\batp\b|men'?s tennis|challenger|itf men|wimbledon men|us open men|australian open men|french open men/.test(combined)) {
    return 'ATP/ITF men'
  }
  if (/wimbledon|us open|australian open|french open|roland garros|tennis/.test(combined)) return 'tennis'
  return null
}

export function isPolymarketTennisMarket(row: RawPolymarketMarketRow): boolean {
  const combined = lowerText(row.question, row.slug, row.event_title, row.event_slug)
  const hasTennisTerm = /tennis|\batp\b|\bwta\b|\bitf\b|wimbledon|roland garros|french open|us open|australian open|challenger/.test(combined)
  const hasMatchWording = /\bbeat\b|\bdefeat\b|\bwin\b|\bvs\b|\bversus\b/.test(combined)
  return hasTennisTerm && hasMatchWording
}

export function inferPolymarketTennisMarketKind(row: RawPolymarketMarketRow): PolymarketTennisMarketKind {
  const combined = lowerText(row.question, row.slug, row.event_title, row.event_slug)
  if (/handicap|spread|\(-?\d+\.?\d*\)|\(\+?\d+\.?\d*\)/.test(combined)) return 'handicap'
  if (/total games|total sets|over\/under|\bover\b|\bunder\b/.test(combined)) return 'total'
  if (/\bvs\.?\b|\bversus\b|\sbeat\s|\sdefeat\s/.test(combined)) return 'match_winner'
  if (/win (?:the )?(?:20\d{2} )?(?:us open|french open|australian open|wimbledon|atp|wta|tournament|title)|winner/.test(combined)) {
    return 'outright'
  }
  return 'other'
}

function cleanPlayerName(value: string | null): string | null {
  if (!value) return null
  const cleaned = value
    .replace(/\?.*$/, '')
    .replace(/\bwill\b/gi, '')
    .replace(/\bwin\b.*$/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
  return cleaned || null
}

export function inferPolymarketPlayers(row: RawPolymarketMarketRow): { playerA: string | null; playerB: string | null } {
  const candidates = [row.question, row.event_title].map((value) => String(value || '').trim()).filter(Boolean)

  for (const candidate of candidates) {
    const afterColon = candidate.includes(':') ? candidate.split(':').slice(1).join(':').trim() : candidate
    const beat = candidate.match(/will\s+(.+?)\s+(?:beat|defeat)\s+(.+?)(?:\?|$)/i)
    if (beat) return { playerA: cleanPlayerName(beat[1] || null), playerB: cleanPlayerName(beat[2] || null) }

    const vs = afterColon.match(/(.+?)\s+(?:vs\.?|versus)\s+(.+?)(?:\?|$)/i)
    if (vs) return { playerA: cleanPlayerName(vs[1] || null), playerB: cleanPlayerName(vs[2] || null) }
  }

  return { playerA: null, playerB: null }
}

export function normalizePolymarketMarket(row: RawPolymarketMarketRow): NormalizedPolymarketMarket {
  const closed = bool(row.closed)
  const outcomePrices = parsePolymarketOutcomePrices(row.outcome_prices)
  const players = inferPolymarketPlayers(row)
  const isTennis = isPolymarketTennisMarket(row)

  return {
    source: 'polymarket',
    id: text(row.id),
    conditionId: text(row.condition_id),
    eventId: text(row.event_id),
    question: text(row.question),
    slug: text(row.slug),
    eventTitle: text(row.event_title),
    eventSlug: text(row.event_slug),
    answer1: text(row.answer1),
    answer2: text(row.answer2),
    token1: text(row.token1),
    token2: text(row.token2),
    closed,
    active: bool(row.active),
    archived: bool(row.archived),
    outcomePrices,
    winner: inferPolymarketWinner({ closed, outcomePrices }),
    volume: numberOrNull(row.volume),
    createdAt: text(row.created_at),
    endDate: text(row.end_date),
    sport: isTennis ? 'tennis' : 'unknown',
    marketKind: inferPolymarketTennisMarketKind(row),
    competitionHint: inferPolymarketCompetitionHint(row),
    playerA: players.playerA,
    playerB: players.playerB,
  }
}

export function normalizePolymarketTrade(row: RawPolymarketTradeRow): NormalizedPolymarketTrade {
  const side = String(row.side || '').toUpperCase()
  const tokenSide = String(row.nonusdc_side || '').toLowerCase()
  return {
    source: 'polymarket',
    timestamp: numberOrNull(row.timestamp),
    marketId: text(row.market_id),
    conditionId: text(row.condition_id),
    eventId: text(row.event_id),
    price: numberOrNull(row.price),
    usdAmount: numberOrNull(row.usd_amount),
    tokenAmount: numberOrNull(row.token_amount),
    side: side === 'BUY' || side === 'SELL' ? side : 'unknown',
    tokenSide: tokenSide === 'token1' || tokenSide === 'token2' ? tokenSide : 'unknown',
    transactionHash: text(row.transaction_hash),
    logIndex: numberOrNull(row.log_index),
  }
}

export function filterPolymarketTennisMarkets(rows: RawPolymarketMarketRow[]): NormalizedPolymarketMarket[] {
  return rows.map(normalizePolymarketMarket).filter((market) => market.sport === 'tennis')
}
