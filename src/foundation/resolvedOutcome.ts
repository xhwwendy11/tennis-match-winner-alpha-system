import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

import type { CanonicalMatchState } from './canonicalMatchState.js'

export type ResolvedOutcomeWinner = 'teamA' | 'teamB'

export interface ResolvedMatchOutcome {
  version: 'resolved-match-outcome/v1'
  resolvedAt: string
  source: 'flashscore'
  matchId: string | null
  flashscoreMatchUrl: string | null
  teamA: string | null
  teamB: string | null
  status: string | null
  setsWonA: number | null
  setsWonB: number | null
  winner: ResolvedOutcomeWinner | null
  confidence: 'high' | 'low'
  reason: string
}

function safeSegment(value: string | null | undefined, fallback: string): string {
  const cleaned = String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return cleaned || fallback
}

function outcomeKey(matchId: string | null | undefined, flashscoreMatchUrl: string | null | undefined): string {
  return matchId ? `id:${matchId}` : `url:${flashscoreMatchUrl || 'unknown'}`
}

function winnerFromSets(setsWonA: number | null, setsWonB: number | null): ResolvedOutcomeWinner | null {
  if (typeof setsWonA !== 'number' || typeof setsWonB !== 'number' || setsWonA === setsWonB) return null
  return setsWonA > setsWonB ? 'teamA' : 'teamB'
}

export function buildResolvedMatchOutcome(input: {
  state: CanonicalMatchState | null
  flashscoreMatchUrl?: string | null
  resolvedAt?: string
}): ResolvedMatchOutcome {
  const state = input.state
  const setsWonA = state?.scoreboard.setsWonA ?? null
  const setsWonB = state?.scoreboard.setsWonB ?? null
  const status = state?.status.matchStatus ?? null
  const winner = status === 'FINAL' ? winnerFromSets(setsWonA, setsWonB) : null

  return {
    version: 'resolved-match-outcome/v1',
    resolvedAt: input.resolvedAt || new Date().toISOString(),
    source: 'flashscore',
    matchId: state?.matchId ?? null,
    flashscoreMatchUrl: state?.source.matchUrl || input.flashscoreMatchUrl || null,
    teamA: state?.participants.teamA.name ?? null,
    teamB: state?.participants.teamB.name ?? null,
    status,
    setsWonA,
    setsWonB,
    winner,
    confidence: winner ? 'high' : 'low',
    reason: winner ? 'final_score_sets' : 'not_final_or_unresolved_sets',
  }
}

export function buildResolvedOutcomeStoragePath(
  outcome: ResolvedMatchOutcome,
  baseDir = 'data/outcomes/flashscore',
): string {
  const resolvedAt = new Date(outcome.resolvedAt)
  const year = String(resolvedAt.getUTCFullYear())
  const month = String(resolvedAt.getUTCMonth() + 1).padStart(2, '0')
  const match = safeSegment(outcome.matchId, 'unknown-match')
  const teams = `${safeSegment(outcome.teamA, 'team-a')}-vs-${safeSegment(outcome.teamB, 'team-b')}`
  return path.join(baseDir, year, month, `${match}__${teams}.json`)
}

async function walkJsonFiles(rootDir: string): Promise<string[]> {
  let entries
  try {
    entries = await readdir(rootDir, { withFileTypes: true })
  } catch {
    return []
  }

  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(rootDir, entry.name)
      if (entry.isDirectory()) return walkJsonFiles(fullPath)
      if (entry.isFile() && fullPath.endsWith('.json')) return [fullPath]
      return []
    }),
  )

  return files.flat()
}

export async function writeResolvedMatchOutcome(
  outcome: ResolvedMatchOutcome,
  baseDir = 'data/outcomes/flashscore',
): Promise<string> {
  const filePath = buildResolvedOutcomeStoragePath(outcome, baseDir)
  await mkdir(path.dirname(filePath), { recursive: true })
  await writeFile(filePath, `${JSON.stringify(outcome, null, 2)}\n`, 'utf8')
  return filePath
}

export async function loadResolvedOutcomeIndex(rootDir: string): Promise<Map<string, ResolvedMatchOutcome>> {
  const files = await walkJsonFiles(rootDir)
  const index = new Map<string, ResolvedMatchOutcome>()

  await Promise.all(
    files.map(async (file) => {
      try {
        const parsed = JSON.parse(await readFile(file, 'utf8')) as ResolvedMatchOutcome
        if (!parsed || parsed.version !== 'resolved-match-outcome/v1') return
        index.set(outcomeKey(parsed.matchId, parsed.flashscoreMatchUrl), parsed)
        if (parsed.matchId) index.set(outcomeKey(parsed.matchId, null), parsed)
        if (parsed.flashscoreMatchUrl) index.set(outcomeKey(null, parsed.flashscoreMatchUrl), parsed)
      } catch {
        // Ignore malformed sidecar files; reports should remain best-effort.
      }
    }),
  )

  return index
}

export function findResolvedOutcome(
  index: Map<string, ResolvedMatchOutcome>,
  input: { matchId?: string | null; flashscoreMatchUrl?: string | null },
): ResolvedMatchOutcome | null {
  return (
    (input.matchId ? index.get(outcomeKey(input.matchId, null)) : null) ??
    (input.flashscoreMatchUrl ? index.get(outcomeKey(null, input.flashscoreMatchUrl)) : null) ??
    index.get(outcomeKey(input.matchId, input.flashscoreMatchUrl)) ??
    null
  )
}
