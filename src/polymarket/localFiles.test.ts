import { mkdtemp, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { readLocalJsonLines, readLocalTable } from './localFiles.js'

describe('polymarket local file loading', () => {
  it('loads JSON arrays', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'pm-local-'))
    const file = path.join(root, 'markets.json')
    await writeFile(file, JSON.stringify([{ id: '1' }, { id: '2' }]), 'utf8')

    expect(await readLocalTable(file)).toEqual([{ id: '1' }, { id: '2' }])
  })

  it('loads JSONL files', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'pm-local-'))
    const file = path.join(root, 'markets.jsonl')
    await writeFile(file, '{"id":"1"}\n{"id":"2"}\n', 'utf8')

    expect(await readLocalTable(file)).toEqual([{ id: '1' }, { id: '2' }])
  })

  it('streams JSONL files', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'pm-local-'))
    const file = path.join(root, 'markets.jsonl')
    await writeFile(file, '{"id":"1"}\n{"id":"2"}\n', 'utf8')

    const rows = []
    for await (const row of readLocalJsonLines(file)) rows.push(row)

    expect(rows).toEqual([{ id: '1' }, { id: '2' }])
  })

  it('loads simple CSV files with quoted commas', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'pm-local-'))
    const file = path.join(root, 'markets.csv')
    await writeFile(file, 'id,question\n1,"Will A beat B, today?"\n', 'utf8')

    expect(await readLocalTable(file)).toEqual([{ id: '1', question: 'Will A beat B, today?' }])
  })
})
