import { afterEach, describe, expect, it } from 'vitest'

import { executeMachineCommand } from './machineCommandExecutor.js'

const originalEnv = { ...process.env }

afterEach(() => {
  process.env = { ...originalEnv }
})

describe('executeMachineCommand', () => {
  it('skips execution by default', async () => {
    const result = await executeMachineCommand('STOP')

    expect(result.outcome).toBe('skipped')
    expect(result.attempted).toBe(false)
    expect(result.enabled).toBe(false)
  })

  it('returns unavailable when no command is provided', async () => {
    const result = await executeMachineCommand(null)

    expect(result.outcome).toBe('unavailable')
    expect(result.machineCommand).toBeNull()
  })

  it('reports missing shell handler when execution is enabled', async () => {
    process.env.FLASHSCORE_EXECUTE_ACTIONS = '1'
    delete process.env.FLASHSCORE_ACTION_STOP

    const result = await executeMachineCommand('STOP')

    expect(result.outcome).toBe('unavailable')
    expect(result.enabled).toBe(true)
  })

  it('executes the configured shell handler when enabled', async () => {
    process.env.FLASHSCORE_EXECUTE_ACTIONS = '1'
    process.env.FLASHSCORE_ACTION_WARN = `${process.execPath} -e "process.exit(0)"`

    const result = await executeMachineCommand('WARN')

    expect(result.outcome).toBe('success')
    expect(result.attempted).toBe(true)
    expect(result.handler).toBe('shell')
  })
})
