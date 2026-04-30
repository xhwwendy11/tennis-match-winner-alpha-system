import { buildLabeledExecutionDataset, type LabeledExecutionDatasetRow } from './labeledExecutionDataset.js'

export interface ExecutionStudyBucket {
  key: string
  sampleCount: number
  labeledCount: number
  directCandidateCount: number
  blockedCandidateCount: number
  watchOnlyCount: number
  passiveTouchCount: number
  passiveTouchRate: number | null
  passiveFillBeforeAdverseCount: number
  passiveFillBeforeAdverseRate: number | null
  adverseMoveBeforePassiveCount: number
  adverseMoveBeforePassiveRate: number | null
  meanPassiveTouchAtSeconds: number | null
  meanAdverseMoveAtSeconds: number | null
  meanEdgeVsLast: number | null
  meanAbsEdgeVsLast: number | null
  meanCrossSpread: number | null
  meanSpreadSide: number | null
}

export interface ExecutionStudy {
  version: 'execution-study/v1'
  generatedAt: string
  rowCount: number
  labeledRowCount: number
  overall: ExecutionStudyBucket
  bySetupType: ExecutionStudyBucket[]
  byProvider: ExecutionStudyBucket[]
  byLegRole: ExecutionStudyBucket[]
  byActionability: ExecutionStudyBucket[]
  byTourType: ExecutionStudyBucket[]
  byQualityTier: ExecutionStudyBucket[]
}

function mean(values: number[]): number | null {
  if (!values.length) return null
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function rate(numerator: number, denominator: number): number | null {
  return denominator > 0 ? numerator / denominator : null
}

function toBucket(key: string, rows: LabeledExecutionDatasetRow[]): ExecutionStudyBucket {
  const labeledRows = rows.filter((row) => row.executionLabels.futureCaptureCount > 0)
  const passiveTouchRows = labeledRows.filter((row) => row.executionLabels.passiveTouch === true)
  const passiveFillRows = labeledRows.filter((row) => row.executionLabels.passiveFillBeforeAdverse === true)
  const adverseRows = labeledRows.filter((row) => row.executionLabels.adverseMoveBeforePassive === true)
  const edgeVsLast = rows
    .map((row) => row.edgeVsLastSide)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
  const crossSpread = rows
    .map((row) => row.crossSpreadSameSide)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
  const spreadSide = rows
    .map((row) => row.spreadSide)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))

  return {
    key,
    sampleCount: rows.length,
    labeledCount: labeledRows.length,
    directCandidateCount: rows.filter((row) => row.actionability === 'direct_candidate').length,
    blockedCandidateCount: rows.filter((row) => row.actionability === 'blocked_candidate').length,
    watchOnlyCount: rows.filter((row) => row.actionability === 'watch_only').length,
    passiveTouchCount: passiveTouchRows.length,
    passiveTouchRate: rate(passiveTouchRows.length, labeledRows.length),
    passiveFillBeforeAdverseCount: passiveFillRows.length,
    passiveFillBeforeAdverseRate: rate(passiveFillRows.length, labeledRows.length),
    adverseMoveBeforePassiveCount: adverseRows.length,
    adverseMoveBeforePassiveRate: rate(adverseRows.length, labeledRows.length),
    meanPassiveTouchAtSeconds: mean(
      passiveTouchRows
        .map((row) => row.executionLabels.passiveTouchAtSeconds)
        .filter((value): value is number => typeof value === 'number' && Number.isFinite(value)),
    ),
    meanAdverseMoveAtSeconds: mean(
      adverseRows
        .map((row) => row.executionLabels.adverseMoveAtSeconds)
        .filter((value): value is number => typeof value === 'number' && Number.isFinite(value)),
    ),
    meanEdgeVsLast: mean(edgeVsLast),
    meanAbsEdgeVsLast: mean(edgeVsLast.map((value) => Math.abs(value))),
    meanCrossSpread: mean(crossSpread),
    meanSpreadSide: mean(spreadSide),
  }
}

function bucketize(rows: LabeledExecutionDatasetRow[], keyFn: (row: LabeledExecutionDatasetRow) => string): ExecutionStudyBucket[] {
  const groups = new Map<string, LabeledExecutionDatasetRow[]>()
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

export async function buildExecutionStudy(
  rootDir: string,
  options: { includeWatchOnly?: boolean; includeBlocked?: boolean } = {},
): Promise<ExecutionStudy> {
  const dataset = await buildLabeledExecutionDataset(rootDir, options)
  const rows = dataset.rows

  return {
    version: 'execution-study/v1',
    generatedAt: new Date().toISOString(),
    rowCount: rows.length,
    labeledRowCount: dataset.labeledRowCount,
    overall: toBucket('overall', rows),
    bySetupType: bucketize(rows, (row) => row.setupType),
    byProvider: bucketize(rows, (row) => row.provider),
    byLegRole: bucketize(rows, (row) => row.legRole),
    byActionability: bucketize(rows, (row) => row.actionability),
    byTourType: bucketize(rows, (row) => row.tourType),
    byQualityTier: bucketize(rows, (row) => row.qualityTier),
  }
}
