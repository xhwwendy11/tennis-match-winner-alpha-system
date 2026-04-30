import type { AtpPlayerBaseline } from '../atp/types.js'
import type { WtaPlayerBaseline } from '../wta/types.js'
import type { ItfPlayerBaseline } from '../itf/types.js'
import type { FlashscoreHistoricalPlayerBaseline } from '../flashscore/historicalBaseline.js'

export type PlayerBaseline = AtpPlayerBaseline | WtaPlayerBaseline | ItfPlayerBaseline | FlashscoreHistoricalPlayerBaseline
export type BaselineCacheSource = PlayerBaseline['source']

export interface BaselineCacheKey {
  source: BaselineCacheSource
  sourcePlayerId: string
  year?: string | number | null
  surface?: string | null
  circuitCode?: string | null
  matchTypeCode?: string | null
}

export interface BaselineCacheRecord {
  key: BaselineCacheKey
  baseline: PlayerBaseline
  fetchedAt: string
}

export interface BaselineCache {
  get(key: BaselineCacheKey): Promise<BaselineCacheRecord | null> | BaselineCacheRecord | null
  set(record: BaselineCacheRecord): Promise<void> | void
}

export function serializeBaselineCacheKey(key: BaselineCacheKey): string {
  return [
    key.source,
    key.sourcePlayerId,
    key.year ?? '',
    key.surface ?? '',
    key.circuitCode ?? '',
    key.matchTypeCode ?? '',
  ].join('::')
}

export class MemoryBaselineCache implements BaselineCache {
  private readonly records = new Map<string, BaselineCacheRecord>()

  get(key: BaselineCacheKey): BaselineCacheRecord | null {
    return this.records.get(serializeBaselineCacheKey(key)) ?? null
  }

  set(record: BaselineCacheRecord): void {
    this.records.set(serializeBaselineCacheKey(record.key), record)
  }
}
