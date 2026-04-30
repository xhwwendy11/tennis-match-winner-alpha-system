import path from 'node:path'

import { FlashscoreHistoricalBaselineProvider } from '../flashscore/historicalBaseline.js'
import { fetchDirectMatchPage } from '../realtime-score/tennis/scoreboardClient.js'

function usage(): never {
  console.error('Usage: tsx src/cli/prefetchFlashscoreHistoricalBaselines.ts <flashscore-match-url> [...more-urls] [--max-matches n] [--min-stat-matches n] [--timeout-ms n]')
  process.exit(1)
}

function getFlag(argv: string[], flag: string): string | undefined {
  const index = argv.indexOf(flag)
  return index >= 0 ? argv[index + 1] : undefined
}

function parseOptionalInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback
}

function positionalArgs(argv: string[]): string[] {
  const out: string[] = []
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i] || ''
    if (arg.startsWith('--')) {
      i += 1
      continue
    }
    out.push(arg)
  }
  return out
}

function playerSlugFromMatchUrl(matchUrl: string, playerId: string): string | null {
  try {
    const parsed = new URL(matchUrl)
    const parts = parsed.pathname.split('/').filter(Boolean)
    for (const part of parts.slice(2)) {
      if (part.endsWith(`-${playerId}`)) return part.slice(0, -playerId.length - 1) || null
    }
  } catch {
    return null
  }
  return null
}

export async function main(argv = process.argv): Promise<void> {
  const urls = positionalArgs(argv)
  if (urls.length === 0) usage()

  const maxMatches = parseOptionalInt(getFlag(argv, '--max-matches'), 12)
  const minStatMatches = parseOptionalInt(getFlag(argv, '--min-stat-matches'), 2)
  const timeoutMs = parseOptionalInt(getFlag(argv, '--timeout-ms'), 8000)
  const provider = new FlashscoreHistoricalBaselineProvider({
    cacheDir: path.resolve(process.cwd(), 'data/baselines/flashscore-history'),
  })

  const results = []
  for (let urlIndex = 0; urlIndex < urls.length; urlIndex += 1) {
    const url = urls[urlIndex]
    console.error(`[baseline:prefetch] match ${urlIndex + 1}/${urls.length} ${url}`)
    try {
      const matches = await fetchDirectMatchPage(url, { force: true, includeRenderedServe: false })
      const match = matches[0] || null
      if (!match) {
        results.push({ url, ok: false, error: 'match_not_found' })
        continue
      }

      const players = [
        {
          side: 'teamA',
          name: match.teamA.name,
          slug: playerSlugFromMatchUrl(match.matchUrl || url, match.teamA.playerId) || match.teamA.slug,
          playerId: match.teamA.playerId,
        },
        {
          side: 'teamB',
          name: match.teamB.name,
          slug: playerSlugFromMatchUrl(match.matchUrl || url, match.teamB.playerId) || match.teamB.slug,
          playerId: match.teamB.playerId,
        },
      ]

      const baselines = []
      for (const player of players) {
        console.error(`[baseline:prefetch] player ${player.side} ${player.name} (${player.playerId})`)
        const baseline = await provider.getPlayerBaseline(player, {
          maxMatches,
          minStatMatches,
          force: true,
          timeoutMs,
        }).catch((error) => ({
          error: error instanceof Error ? error.message : String(error),
        }))
        baselines.push({
          side: player.side,
          name: player.name,
          playerId: player.playerId,
          slug: player.slug,
          baseline,
        })
      }

      results.push({
        url,
        ok: true,
        matchId: match.eventId,
        match: `${match.teamA.name} vs ${match.teamB.name}`,
        baselines,
      })
    } catch (error) {
      results.push({ url, ok: false, error: error instanceof Error ? error.message : String(error) })
    }
  }

  console.log(JSON.stringify(results, null, 2))
}

main().then(() => {
  process.exit(0)
}).catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }, null, 2))
  process.exit(1)
})
