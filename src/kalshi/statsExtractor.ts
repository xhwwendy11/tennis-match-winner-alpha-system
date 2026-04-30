import { chromium } from 'playwright-core'

import { buildCanonicalMarketState, type CanonicalMarketState, type MarketStatus } from '../foundation/canonicalMarketState.js'
import type { KalshiDisplayStats } from './types.js'

const CHROME_EXECUTABLE_PATH = process.env.FLASHSCORE_CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

function toLeadingInteger(value: string | null | undefined): number | null {
  const match = String(value || '').match(/-?\d+/)
  if (!match) return null
  const parsed = Number(match[0])
  return Number.isFinite(parsed) ? parsed : null
}

function cleanLines(text: string): string[] {
  return String(text || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

function toPriceCents(value: string | null | undefined): number | null {
  const match = String(value || '').match(/(\d+)\s*¢/)
  if (!match) return null
  const parsed = Number(match[1])
  return Number.isFinite(parsed) ? parsed : null
}

function toPercent(value: string | null | undefined): number | null {
  const match = String(value || '').match(/(\d+)\s*%/)
  if (!match) return null
  const parsed = Number(match[1])
  return Number.isFinite(parsed) ? parsed : null
}

function toVolume(value: string | null | undefined): number | null {
  const match = String(value || '').match(/\$([\d,]+)\s*vol/i)
  if (!match) return null
  const parsed = Number(match[1].replace(/,/g, ''))
  return Number.isFinite(parsed) ? parsed : null
}

function lineAfter(lines: string[], label: string): string | null {
  const idx = lines.findIndex((line) => line === label)
  if (idx < 0 || idx + 1 >= lines.length) return null
  return lines[idx + 1] || null
}

function firstMatchingLine(lines: string[], pattern: RegExp): string | null {
  return lines.find((line) => pattern.test(line)) || null
}

function normalizePageMarketStatus(lines: string[]): MarketStatus {
  if (lines.includes('LIVE')) return 'OPEN'
  const combined = lines.join(' ').toLowerCase()
  if (/\blive\b|\bopen\b|\bactive\b/.test(combined)) return 'OPEN'
  if (/\bpaused?\b|\bhalt/.test(combined)) return 'PAUSED'
  if (/\bclosed?\b/.test(combined)) return 'CLOSED'
  if (/\bsettled?\b|\bresolved?\b/.test(combined)) return 'SETTLED'
  return 'UNKNOWN'
}

function statsWindow(lines: string[]): string[] {
  const idx = lines.findIndex((line) => line === 'Aces')
  if (idx < 0) return []
  return lines.slice(Math.max(0, idx - 2), idx + 32)
}

function valueAroundLabel(lines: string[], label: string): { a: string | null; b: string | null } {
  const idx = lines.findIndex((line) => line === label)
  if (idx < 1 || idx + 1 >= lines.length) {
    return { a: null, b: null }
  }
  return {
    a: lines[idx - 1] || null,
    b: lines[idx + 1] || null,
  }
}

export function parseKalshiDisplayStatsFromText(text: string): KalshiDisplayStats | null {
  const lines = statsWindow(cleanLines(text))
  if (lines.length === 0) return null

  const aces = valueAroundLabel(lines, 'Aces')
  const doubleFaults = valueAroundLabel(lines, 'Double faults')
  const pointsWon = valueAroundLabel(lines, 'Points won')
  const firstServeWon = valueAroundLabel(lines, '1st serve won')
  const secondServeWon = valueAroundLabel(lines, '2nd serve won')
  const serviceGamesWon = valueAroundLabel(lines, 'Service games won')
  const breakPoints = valueAroundLabel(lines, 'Break points')

  return {
    acesA: toLeadingInteger(aces.a),
    acesB: toLeadingInteger(aces.b),
    doubleFaultsA: toLeadingInteger(doubleFaults.a),
    doubleFaultsB: toLeadingInteger(doubleFaults.b),
    pointsWonA: toLeadingInteger(pointsWon.a),
    pointsWonB: toLeadingInteger(pointsWon.b),
    firstServeWonA: firstServeWon.a,
    firstServeWonB: firstServeWon.b,
    secondServeWonA: secondServeWon.a,
    secondServeWonB: secondServeWon.b,
    serviceGamesWonA: toLeadingInteger(serviceGamesWon.a),
    serviceGamesWonB: toLeadingInteger(serviceGamesWon.b),
    breakPointsDisplayA: breakPoints.a,
    breakPointsDisplayB: breakPoints.b,
  }
}

export function parseCanonicalKalshiMarketStateFromText(text: string): CanonicalMarketState | null {
  const lines = cleanLines(text)
  if (lines.length === 0) return null

  const marketTitle = firstMatchingLine(lines, /^.+ vs .+$/)
  const eventTicker = lineAfter(lines, 'Event')
  const marketTicker = lineAfter(lines, 'Market')
  const volumeLine = firstMatchingLine(lines, /\$\d[\d,]*\s*vol/i)
  const selectedChanceLine = firstMatchingLine(lines, /^Chance$/)
  const selectedChanceIndex = selectedChanceLine ? lines.findIndex((line) => line === selectedChanceLine) : -1

  let lastPrice: number | null = null
  let yesAsk: number | null = null
  let noAsk: number | null = null

  if (selectedChanceIndex >= 0) {
    const tail = lines.slice(selectedChanceIndex, Math.min(lines.length, selectedChanceIndex + 12))
    const percentLine = tail.find((line) => /%$/.test(line))
    const yesLine = tail.find((line) => /^Yes\s+\d+\s*¢$/i.test(line))
    const noLine = tail.find((line) => /^No\s+\d+\s*¢$/i.test(line))
    lastPrice = toPercent(percentLine)
    yesAsk = toPriceCents(yesLine)
    noAsk = toPriceCents(noLine)
  }

  if (
    marketTitle == null &&
    eventTicker == null &&
    marketTicker == null &&
    lastPrice == null &&
    yesAsk == null &&
    noAsk == null
  ) {
    return null
  }

  return buildCanonicalMarketState({
    provider: 'kalshi',
    eventTicker,
    marketTicker,
    marketTitle,
    marketStatus: normalizePageMarketStatus(lines),
    yesBid: null,
    yesAsk,
    noBid: null,
    noAsk,
    lastPrice,
    volume: toVolume(volumeLine),
    marketTimestamp: new Date().toISOString(),
  })
}

export async function extractKalshiDisplayStats(marketUrl: string): Promise<KalshiDisplayStats | null> {
  const browser = await chromium.launch({
    executablePath: CHROME_EXECUTABLE_PATH,
    headless: true,
    args: ['--no-sandbox'],
  })

  let page = null
  try {
    page = await browser.newPage()
    await page.goto(marketUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 })
    await page.waitForTimeout(5_000)

    const info = page.getByText('Match info')
    if (await info.count()) {
      await info.first().click().catch(() => {})
      await page.waitForTimeout(2_000)
    }

    const bodyText = await page.locator('body').innerText()
    return parseKalshiDisplayStatsFromText(bodyText)
  } finally {
    await page?.close().catch(() => {})
    await browser.close().catch(() => {})
  }
}

export async function extractCanonicalKalshiMarketStateFromPage(marketUrl: string): Promise<CanonicalMarketState | null> {
  const browser = await chromium.launch({
    executablePath: CHROME_EXECUTABLE_PATH,
    headless: true,
    args: ['--no-sandbox'],
  })

  let page = null
  try {
    page = await browser.newPage()
    await page.goto(marketUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 })
    await page.waitForTimeout(5_000)

    const bodyText = await page.locator('body').innerText()
    return parseCanonicalKalshiMarketStateFromText(bodyText)
  } finally {
    await page?.close().catch(() => {})
    await browser.close().catch(() => {})
  }
}
