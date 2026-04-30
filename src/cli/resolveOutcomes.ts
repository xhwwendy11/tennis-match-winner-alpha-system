import path from 'node:path'

import { buildCanonicalMatchState } from '../foundation/canonicalMatchState.js'
import { loadDecisionSnapshots } from '../foundation/calibrationReport.js'
import { buildResolvedMatchOutcome, writeResolvedMatchOutcome } from '../foundation/resolvedOutcome.js'
import { fetchDirectMatchPage } from '../realtime-score/tennis/scoreboardClient.js'

interface ResolveSummary {
  ok: true
  snapshotCount: number
  uniqueMatchUrls: number
  fetchedCount: number
  resolvedCount: number
  unresolvedCount: number
  written: string[]
  unresolved: Array<{ url: string; reason: string }>
}

function parsePositiveInteger(value: string | undefined): number | null {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out after ${timeoutMs}ms: ${label}`)), timeoutMs)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        clearTimeout(timer)
        reject(error)
      },
    )
  })
}

function parseArgs(argv: string[]): { snapshotRootDir: string; outcomeRootDir: string; limit: number | null; timeoutMs: number } {
  const args = argv.slice(2)
  let snapshotRootDir: string | null = null
  let outcomeRootDir = path.resolve(process.cwd(), 'data/outcomes/flashscore')
  let limit: number | null = null
  let timeoutMs = 15000

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === '--outcomes') {
      outcomeRootDir = args[index + 1] || outcomeRootDir
      index += 1
      continue
    }
    if (arg === '--limit') {
      limit = parsePositiveInteger(args[index + 1])
      index += 1
      continue
    }
    if (arg === '--timeout-ms') {
      timeoutMs = parsePositiveInteger(args[index + 1]) || timeoutMs
      index += 1
      continue
    }
    if (!arg.startsWith('--') && !snapshotRootDir) snapshotRootDir = arg
  }

  return { snapshotRootDir: snapshotRootDir || path.resolve(process.cwd(), 'snapshots'), outcomeRootDir, limit, timeoutMs }
}

export async function main(argv = process.argv): Promise<void> {
  const { snapshotRootDir, outcomeRootDir, limit, timeoutMs } = parseArgs(argv)
  const snapshots = await loadDecisionSnapshots(snapshotRootDir)
  const allUrls = [
    ...new Set(
      snapshots
        .map((snapshot) => snapshot.urls.flashscoreMatchUrl)
        .filter((url): url is string => typeof url === 'string' && url.length > 0),
    ),
  ]
  const urls = limit ? allUrls.slice(0, limit) : allUrls

  const written: string[] = []
  const unresolved: ResolveSummary['unresolved'] = []

  for (let index = 0; index < urls.length; index += 1) {
    const url = urls[index]
    console.error(`[resolve:outcomes] ${index + 1}/${urls.length} ${url}`)
    try {
      const matches = await withTimeout(
        fetchDirectMatchPage(url, { force: true, includeRenderedServe: false }),
        timeoutMs,
        url,
      )
      const state = buildCanonicalMatchState(Array.isArray(matches) ? matches[0] || null : null)
      const outcome = buildResolvedMatchOutcome({ state, flashscoreMatchUrl: url })
      if (outcome.winner) {
        written.push(await writeResolvedMatchOutcome(outcome, outcomeRootDir))
      } else {
        unresolved.push({ url, reason: outcome.reason })
      }
    } catch (error) {
      unresolved.push({ url, reason: error instanceof Error ? error.message : String(error) })
    }
  }

  const summary: ResolveSummary = {
    ok: true,
    snapshotCount: snapshots.length,
    uniqueMatchUrls: urls.length,
    fetchedCount: urls.length,
    resolvedCount: written.length,
    unresolvedCount: unresolved.length,
    written,
    unresolved,
  }
  console.log(JSON.stringify(summary, null, 2))
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(JSON.stringify({ ok: false, error: message }, null, 2))
  process.exit(1)
})
