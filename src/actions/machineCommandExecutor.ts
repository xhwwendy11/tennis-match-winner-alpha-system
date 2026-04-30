import { exec } from 'node:child_process'
import { promisify } from 'node:util'

import type { MachineCommand } from '../rules/tennis/pointRiskEngine.js'

const execAsync = promisify(exec)

export interface MachineActionExecution {
  enabled: boolean
  attempted: boolean
  handler: 'noop' | 'shell'
  outcome: 'skipped' | 'success' | 'failed' | 'unavailable'
  machineCommand: MachineCommand | null
  shellCommand: string | null
  detail: string | null
}

function envVarNameFor(command: MachineCommand): string {
  return `FLASHSCORE_ACTION_${command}`
}

export async function executeMachineCommand(command: MachineCommand | null): Promise<MachineActionExecution> {
  if (!command) {
    return {
      enabled: false,
      attempted: false,
      handler: 'noop',
      outcome: 'unavailable',
      machineCommand: null,
      shellCommand: null,
      detail: 'No machine command to execute.',
    }
  }

  const enabled = process.env.FLASHSCORE_EXECUTE_ACTIONS === '1'
  const envVarName = envVarNameFor(command)
  const shellCommand = String(process.env[envVarName] || '').trim() || null

  if (!enabled) {
    return {
      enabled: false,
      attempted: false,
      handler: 'noop',
      outcome: 'skipped',
      machineCommand: command,
      shellCommand,
      detail: 'Execution disabled. Set FLASHSCORE_EXECUTE_ACTIONS=1 to enable action handlers.',
    }
  }

  if (!shellCommand) {
    return {
      enabled: true,
      attempted: false,
      handler: 'noop',
      outcome: 'unavailable',
      machineCommand: command,
      shellCommand: null,
      detail: `Missing handler command in ${envVarName}.`,
    }
  }

  try {
    await execAsync(shellCommand, {
      env: process.env,
      shell: process.env.SHELL || '/bin/zsh',
    })
    return {
      enabled: true,
      attempted: true,
      handler: 'shell',
      outcome: 'success',
      machineCommand: command,
      shellCommand,
      detail: null,
    }
  } catch (error) {
    return {
      enabled: true,
      attempted: true,
      handler: 'shell',
      outcome: 'failed',
      machineCommand: command,
      shellCommand,
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}
