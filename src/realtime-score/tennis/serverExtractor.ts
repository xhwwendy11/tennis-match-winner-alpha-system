import { chromium } from 'playwright-core'

export type TennisServingSide = 'teamA' | 'teamB' | null

const CHROME_EXECUTABLE_PATH = process.env.FLASHSCORE_CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const SERVE_TIMEOUT_MS = Number(process.env.FLASHSCORE_SERVE_TIMEOUT_MS || 6_500)

type ServingInfo = {
  serverSide: TennisServingSide
  serverSideResolved: TennisServingSide
  serverSideSource: 'dom' | 'retry' | 'unknown'
  serveConfidence: 'high' | 'low'
  serverPlayerName: string | null
}

type ServeMarkerSnapshot = {
  homeParticipantServe: boolean
  awayParticipantServe: boolean
  homeScoreboardServe: boolean
  awayScoreboardServe: boolean
  homeFixedHeaderServe: boolean
  awayFixedHeaderServe: boolean
  homeName: string | null
  awayName: string | null
}

let browserPromise: Promise<Awaited<ReturnType<typeof chromium.launch>>> | null = null

function serveTimeoutMs(): number {
  return Number.isFinite(SERVE_TIMEOUT_MS) && SERVE_TIMEOUT_MS > 0 ? Math.floor(SERVE_TIMEOUT_MS) : 6_500
}

async function getBrowser(): Promise<Awaited<ReturnType<typeof chromium.launch>>> {
  if (!browserPromise) {
    browserPromise = chromium.launch({
      executablePath: CHROME_EXECUTABLE_PATH,
      headless: true,
      args: ['--no-sandbox'],
    })
  }
  return browserPromise
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return await Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      const timer = setTimeout(() => {
        clearTimeout(timer)
        reject(new Error(`Serve extraction timed out after ${timeoutMs}ms`))
      }, timeoutMs)
    }),
  ])
}

function hasServeMarker(root: ParentNode | null, selectors: string[]): boolean {
  return selectors.some((selector) => !!root?.querySelector(selector))
}

function normalizeName(value: string | null | undefined): string | null {
  const normalized = String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
  return normalized || null
}

export function resolveServingSideFromSnapshot(snapshot: ServeMarkerSnapshot): {
  serverSide: Exclude<TennisServingSide, null>
  serverPlayerName: string | null
} | null {
  const homeServe = snapshot.homeParticipantServe || snapshot.homeScoreboardServe || snapshot.homeFixedHeaderServe
  const awayServe = snapshot.awayParticipantServe || snapshot.awayScoreboardServe || snapshot.awayFixedHeaderServe

  if (homeServe && !awayServe) {
    return {
      serverSide: 'teamA',
      serverPlayerName: snapshot.homeName,
    }
  }

  if (awayServe && !homeServe) {
    return {
      serverSide: 'teamB',
      serverPlayerName: snapshot.awayName,
    }
  }

  return null
}

const PARTICIPANT_SERVE_MARKER_SELECTOR = '[title="Serving player"]'

async function readServingSnapshotFromPage(
  page: Awaited<ReturnType<Awaited<ReturnType<typeof chromium.launch>>['newPage']>>,
): Promise<ServeMarkerSnapshot> {
  return await page.evaluate((serveSelector) => {
    const homeRoot = document.querySelector('.duelParticipant__home')
    const awayRoot = document.querySelector('.duelParticipant__away')
    const homeScoreboardRoot = document.querySelector('.smh__service.smh__home')
    const awayScoreboardRoot = document.querySelector('.smh__service.smh__away')
    const fixedRoots = Array.from(document.querySelectorAll('.fixedHeaderParticipant__participantServe'))
    const homeFixedRoot = fixedRoots[0] || null
    const awayFixedRoot = fixedRoots[1] || null

    const homeNameRaw =
      homeRoot?.querySelector('.participant__participantName')?.textContent ||
      document.querySelector('.smh__participantName.smh__home')?.textContent ||
      ''
    const awayNameRaw =
      awayRoot?.querySelector('.participant__participantName')?.textContent ||
      document.querySelector('.smh__participantName.smh__away')?.textContent ||
      ''

    const homeName = String(homeNameRaw).replace(/\s+/g, ' ').trim() || null
    const awayName = String(awayNameRaw).replace(/\s+/g, ' ').trim() || null

    return {
      homeParticipantServe: !!homeRoot?.querySelector(`.participant__participantServe ${serveSelector}`),
      awayParticipantServe: !!awayRoot?.querySelector(`.participant__participantServe ${serveSelector}`),
      homeScoreboardServe: !!homeScoreboardRoot?.querySelector(serveSelector),
      awayScoreboardServe: !!awayScoreboardRoot?.querySelector(serveSelector),
      homeFixedHeaderServe: !!homeFixedRoot?.querySelector(serveSelector),
      awayFixedHeaderServe: !!awayFixedRoot?.querySelector(serveSelector),
      homeName,
      awayName,
    }
  }, PARTICIPANT_SERVE_MARKER_SELECTOR)
}

async function waitForServeMarker(
  page: Awaited<ReturnType<Awaited<ReturnType<typeof chromium.launch>>['newPage']>>,
  timeoutMs: number,
): Promise<{ serverSide: Exclude<TennisServingSide, null>; serverPlayerName: string | null } | null> {
  const deadline = Date.now() + timeoutMs

  while (Date.now() <= deadline) {
    const snapshot = await readServingSnapshotFromPage(page)
    if (process.env.FLASHSCORE_DEBUG_SERVE === '1') {
      console.error('[flashscore-serve-debug:snapshot]', snapshot)
    }
    const resolved = resolveServingSideFromSnapshot(snapshot)
    if (resolved) return resolved
    await page.waitForTimeout(250)
  }

  return null
}

export async function extractServingSideFromRenderedPage(matchUrl: string): Promise<ServingInfo> {
  let page: Awaited<ReturnType<Awaited<ReturnType<typeof chromium.launch>>['newPage']>> | null = null
  try {
    const browser = await withTimeout(getBrowser(), serveTimeoutMs())

    page = await browser.newPage()
    const timeoutMs = serveTimeoutMs()
    const extractionBudgetMs = Math.max(timeoutMs + 2_000, Math.floor(timeoutMs * 2.25))
    const servingInfo = await withTimeout(
      (async () => {
        await page!.goto(matchUrl, { waitUntil: 'domcontentloaded', timeout: timeoutMs })
        await page!.waitForSelector('.duelParticipant', { timeout: timeoutMs })
        await page!.waitForTimeout(Math.min(1_000, Math.max(250, Math.floor(timeoutMs * 0.35))))

        const firstAttempt = await waitForServeMarker(page!, Math.max(500, Math.floor(timeoutMs * 0.5)))
        if (firstAttempt) {
          return {
            serverSide: firstAttempt.serverSide,
            serverSideResolved: firstAttempt.serverSide,
            serverSideSource: 'dom' as const,
            serveConfidence: 'high' as const,
            serverPlayerName: firstAttempt.serverPlayerName,
          }
        }

        await page!.waitForTimeout(Math.min(1_250, Math.max(300, Math.floor(timeoutMs * 0.2))))

        const retryAttempt = await waitForServeMarker(page!, Math.max(500, Math.floor(timeoutMs * 0.45)))
        if (retryAttempt) {
          return {
            serverSide: null,
            serverSideResolved: retryAttempt.serverSide,
            serverSideSource: 'retry' as const,
            serveConfidence: 'high' as const,
            serverPlayerName: retryAttempt.serverPlayerName,
          }
        }

        return {
          serverSide: null,
          serverSideResolved: null,
          serverSideSource: 'unknown' as const,
          serveConfidence: 'low' as const,
          serverPlayerName: null,
        }
      })(),
      extractionBudgetMs,
    )

    return servingInfo
  } catch (error) {
    if (process.env.FLASHSCORE_DEBUG_SERVE === '1') {
      console.error('[flashscore-serve-debug]', error)
    }
    return {
      serverSide: null,
      serverSideResolved: null,
      serverSideSource: 'unknown',
      serveConfidence: 'low',
      serverPlayerName: null,
    }
  } finally {
    await page?.close().catch(() => {})
  }
}
