import { readFile } from 'node:fs/promises'
import { createReadStream } from 'node:fs'
import readline from 'node:readline'

function parseJsonLines(text: string): unknown[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as unknown)
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = []
  let current = ''
  let quoted = false

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    const next = line[index + 1]
    if (char === '"' && quoted && next === '"') {
      current += '"'
      index += 1
      continue
    }
    if (char === '"') {
      quoted = !quoted
      continue
    }
    if (char === ',' && !quoted) {
      cells.push(current)
      current = ''
      continue
    }
    current += char
  }

  cells.push(current)
  return cells
}

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((line) => line.trim())
  if (lines.length === 0) return []
  const headers = parseCsvLine(lines[0] || '').map((header) => header.trim())
  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line)
    const row: Record<string, string> = {}
    headers.forEach((header, index) => {
      row[header] = cells[index] ?? ''
    })
    return row
  })
}

export async function readLocalTable(filePath: string): Promise<unknown[]> {
  const text = await readFile(filePath, 'utf8')
  const lower = filePath.toLowerCase()
  if (lower.endsWith('.jsonl') || lower.endsWith('.ndjson')) return parseJsonLines(text)
  if (lower.endsWith('.csv')) return parseCsv(text)
  const parsed = JSON.parse(text) as unknown
  if (Array.isArray(parsed)) return parsed
  if (parsed && typeof parsed === 'object' && Array.isArray((parsed as { rows?: unknown[] }).rows)) {
    return (parsed as { rows: unknown[] }).rows
  }
  return [parsed]
}

export async function* readLocalJsonLines(filePath: string): AsyncGenerator<unknown> {
  const input = createReadStream(filePath, { encoding: 'utf8' })
  const lines = readline.createInterface({
    input,
    crlfDelay: Infinity,
  })

  for await (const line of lines) {
    const trimmed = String(line || '').trim()
    if (!trimmed) continue
    yield JSON.parse(trimmed) as unknown
  }
}
