import {
  buildResolvedExecutionAudit,
  type ResolvedExecutionAudit,
  type ResolvedExecutionAuditRow,
} from './resolvedExecutionAudit.js'

export type PolicyRecommendation = 'expand' | 'hold' | 'tighten' | 'insufficient_data'

export interface PolicySegmentBucket {
  key: string
  sampleCount: number
  permittedCount: number
  executeCount: number
  correctDirectionCount: number
  correctDirectionRate: number | null
  permittedCorrectCount: number
  permittedCorrectRate: number | null
  meanExecutionScore: number | null
  meanEdgeVsLastSide: number | null
  meanBankrollFraction: number | null
  recommendation: PolicyRecommendation
  recommendationReason: string
}

export interface PolicySegmentAudit {
  version: 'policy-segment-audit/v1'
  generatedAt: string
  resolvedCount: number
  overall: PolicySegmentBucket
  byTourSetupRegimeProvider: PolicySegmentBucket[]
  byTourType: PolicySegmentBucket[]
  bySetupType: PolicySegmentBucket[]
  byRegimeTag: PolicySegmentBucket[]
  byPrimaryProvider: PolicySegmentBucket[]
  rows: ResolvedExecutionAuditRow[]
}

function mean(values: number[]): number | null {
  if (!values.length) return null
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function recommend(bucket: Omit<PolicySegmentBucket, 'recommendation' | 'recommendationReason'>): {
  recommendation: PolicyRecommendation
  recommendationReason: string
} {
  if (bucket.sampleCount < 2) {
    return {
      recommendation: 'insufficient_data',
      recommendationReason: 'sample_count_below_threshold',
    }
  }
  if (bucket.permittedCount === 0) {
    return {
      recommendation: 'hold',
      recommendationReason: 'no_permitted_executions_in_segment',
    }
  }
  const rate = bucket.permittedCorrectRate ?? bucket.correctDirectionRate
  if (rate == null) {
    return {
      recommendation: 'insufficient_data',
      recommendationReason: 'no_directional_labels',
    }
  }
  if (rate >= 0.65) {
    return {
      recommendation: 'expand',
      recommendationReason: 'permitted_correct_rate_strong',
    }
  }
  if (rate <= 0.4) {
    return {
      recommendation: 'tighten',
      recommendationReason: 'permitted_correct_rate_weak',
    }
  }
  return {
    recommendation: 'hold',
    recommendationReason: 'segment_performance_mixed',
  }
}

function toBucket(key: string, rows: ResolvedExecutionAuditRow[]): PolicySegmentBucket {
  const directionRows = rows.filter((row) => row.correctDirection != null)
  const permittedRows = rows.filter((row) => row.regimePermitted && row.correctDirection != null)
  const scoreValues = rows
    .map((row) => row.executionScore)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
  const edgeValues = rows
    .map((row) => row.edgeVsLastSide)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
  const bankrollValues = rows
    .map((row) => row.bankrollFraction)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))

  const base = {
    key,
    sampleCount: rows.length,
    permittedCount: rows.filter((row) => row.regimePermitted).length,
    executeCount: rows.filter((row) => row.action === 'execute').length,
    correctDirectionCount: directionRows.filter((row) => row.correctDirection === true).length,
    correctDirectionRate: directionRows.length
      ? directionRows.filter((row) => row.correctDirection === true).length / directionRows.length
      : null,
    permittedCorrectCount: permittedRows.filter((row) => row.correctDirection === true).length,
    permittedCorrectRate: permittedRows.length
      ? permittedRows.filter((row) => row.correctDirection === true).length / permittedRows.length
      : null,
    meanExecutionScore: mean(scoreValues),
    meanEdgeVsLastSide: mean(edgeValues),
    meanBankrollFraction: mean(bankrollValues),
  }

  return {
    ...base,
    ...recommend(base),
  }
}

function bucketize(rows: ResolvedExecutionAuditRow[], keyFn: (row: ResolvedExecutionAuditRow) => string): PolicySegmentBucket[] {
  const groups = new Map<string, ResolvedExecutionAuditRow[]>()
  for (const row of rows) {
    const key = keyFn(row)
    const group = groups.get(key)
    if (group) group.push(row)
    else groups.set(key, [row])
  }

  return [...groups.entries()]
    .map(([key, group]) => toBucket(key, group))
    .sort((a, b) => b.sampleCount - a.sampleCount || a.key.localeCompare(b.key))
}

export async function buildPolicySegmentAudit(
  rootDir: string,
  options: {
    outcomeRootDir: string
    includeWatchOnly?: boolean
    includeBlocked?: boolean
    rankingLimit?: number
  },
): Promise<PolicySegmentAudit> {
  const audit: ResolvedExecutionAudit = await buildResolvedExecutionAudit(rootDir, options)
  const rows = audit.rows

  return {
    version: 'policy-segment-audit/v1',
    generatedAt: new Date().toISOString(),
    resolvedCount: rows.length,
    overall: toBucket('overall', rows),
    byTourSetupRegimeProvider: bucketize(
      rows,
      (row) => `${row.tourType}:${row.setupType}:${row.regimeTag}:${row.primaryProvider}`,
    ),
    byTourType: bucketize(rows, (row) => row.tourType),
    bySetupType: bucketize(rows, (row) => row.setupType),
    byRegimeTag: bucketize(rows, (row) => row.regimeTag),
    byPrimaryProvider: bucketize(rows, (row) => row.primaryProvider),
    rows,
  }
}
