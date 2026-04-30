import { buildExecutionRankingReport, type ExecutionRankingReport, type ExecutionRankingRow } from './executionRanking.js'

export interface ExecutionShortlist {
  version: 'execution-shortlist/v1'
  generatedAt: string
  rankedCount: number
  shortlistCount: number
  shortlist: ExecutionRankingRow[]
  byProvider: Record<'kalshi' | 'polymarket', ExecutionRankingRow[]>
}

export async function buildExecutionShortlist(
  rootDir: string,
  options: {
    includeWatchOnly?: boolean
    includeBlocked?: boolean
    limit?: number
  } = {},
): Promise<ExecutionShortlist> {
  const ranking: ExecutionRankingReport = await buildExecutionRankingReport(rootDir, {
    includeWatchOnly: options.includeWatchOnly,
    includeBlocked: options.includeBlocked,
    limit: options.limit ? Math.max(options.limit * 5, options.limit) : 100,
  })

  const limit = options.limit ?? 25
  const shortlist = ranking.topRows.filter((row) => row.executionEligible).slice(0, limit)
  const byProvider = {
    kalshi: ranking.byProviderTop.kalshi.filter((row) => row.executionEligible).slice(0, limit),
    polymarket: ranking.byProviderTop.polymarket.filter((row) => row.executionEligible).slice(0, limit),
  }

  return {
    version: 'execution-shortlist/v1',
    generatedAt: new Date().toISOString(),
    rankedCount: ranking.rankedCount,
    shortlistCount: shortlist.length,
    shortlist,
    byProvider,
  }
}
