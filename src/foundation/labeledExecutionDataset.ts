import { buildExecutionDatasetRows, type ExecutionDatasetRow } from './executionDataset.js'
import { groupComparisonsByPath, labelExecutionRow, type ExecutionLabels } from './executionLabeling.js'
import { loadMultiMarketComparisons } from './multiMarketReport.js'
import type { MultiMarketComparison } from './multiMarketComparison.js'

export interface LabeledExecutionDatasetRow extends ExecutionDatasetRow {
  executionLabels: ExecutionLabels
}

export interface LabeledExecutionDataset {
  version: 'labeled-execution-dataset/v1'
  generatedAt: string
  comparisonCount: number
  rowCount: number
  labeledRowCount: number
  rows: LabeledExecutionDatasetRow[]
}

function pathKey(comparison: MultiMarketComparison): string {
  return comparison.urls.flashscoreMatchUrl || comparison.match.matchId || `${comparison.match.teamA || 'unknown'}__${comparison.match.teamB || 'unknown'}`
}

export function buildLabeledExecutionRows(
  comparison: MultiMarketComparison,
  samePathComparisons: MultiMarketComparison[],
  options: { includeWatchOnly?: boolean; includeBlocked?: boolean } = {},
): LabeledExecutionDatasetRow[] {
  return buildExecutionDatasetRows(comparison, options).map((row) => ({
    ...row,
    executionLabels: labelExecutionRow(row, comparison, samePathComparisons),
  }))
}

export async function buildLabeledExecutionDataset(
  rootDir: string,
  options: { includeWatchOnly?: boolean; includeBlocked?: boolean } = {},
): Promise<LabeledExecutionDataset> {
  const comparisons = await loadMultiMarketComparisons(rootDir)
  const byPath = groupComparisonsByPath(comparisons)

  const rows = comparisons.flatMap((comparison) =>
    buildLabeledExecutionRows(comparison, byPath.get(pathKey(comparison)) || [comparison], options),
  )

  return {
    version: 'labeled-execution-dataset/v1',
    generatedAt: new Date().toISOString(),
    comparisonCount: comparisons.length,
    rowCount: rows.length,
    labeledRowCount: rows.filter((row) => row.executionLabels.futureCaptureCount > 0).length,
    rows,
  }
}
