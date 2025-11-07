import { $ } from 'bun'
import chalk from 'chalk'
import { isPlainObject } from 'ytil'

import { Spinner } from './Spinner'
import { createSSHShell, SSHShell, SSHShellOptions } from './ssh'

export function createShell(options: ShellOptions = {}): Shell {
  let $verbose = options.verbose ?? false

  const $$ = (parts: TemplateStringsArray, ...expressions: Bun.ShellExpression[]) => {
    const promise = $(parts, ...expressions).quiet()

    let spinner: Spinner | null = null

    const orig_then = promise.then
    Object.defineProperty(promise, 'then', {
      value: (onfulfilled: any, onrejected: any) => {
        let commandLogged = false
        if ($verbose) {
          logShellCommand(parts, expressions)
          commandLogged = true
          spinner = new Spinner()
          spinner.start()
        }
        return orig_then.call(
          promise,
          output => {
            spinner?.stop()
            if ($verbose) {
              logShellOutput(output)
            }
            return onfulfilled != null ? onfulfilled(output) : output
          },
          error => {
            spinner?.stop()

            if (!commandLogged) {
              process.stderr.write(chalk`{red ⨉} Shell command failed:\n`)
              logShellCommand(parts, expressions)
            }

            const output = error instanceof $.ShellError ? error : null
            logShellOutput(output)
            process.exit(1)
          },
        )
      },
    })

    return promise
  }

  $$.braces = $.braces
  $$.escape = $.escape
  $$.env = $.env
  $$.cwd = $.cwd
  $$.nothrow = $.nothrow
  $$.throws = $.throws

  $$.verbose = ((verbose?: boolean) => {
    if (verbose != null) {
      $verbose = verbose
    } else {
      return $verbose
    }
  })

  $$.ssh = createSSHShell.bind(null, $$ as Shell)
  
  return $$ as Shell
}

export type Shell = typeof $ & {
  verbose(verbose: boolean): void
  verbose(): boolean

  ssh(remote: string, options?: SSHShellOptions): SSHShell
}

function logShellCommand(parts: TemplateStringsArray, expressions: Bun.ShellExpression[]) {
  const command = buildCommand(parts, expressions)
  process.stderr.write(chalk`  {inverse $ ${command}}`)
}

function logShellOutput(output: $.ShellOutput | null) {
  if (output == null) {
    process.stderr.write('\n')
    return
  }

  const formattedExitCode = output.exitCode === 0 ? chalk`{bgGreen  0 }` : chalk`{bgRed  ${output.exitCode} }`
  process.stderr.write(chalk`{inverse  } ${formattedExitCode}\n`)

  const stdout = output.stdout.toString('utf8').split('\n').map(it => it.trim()).filter(line => line.length > 0)
  stdout.forEach(line => { process.stderr.write(chalk`  {dim.inverse   ${line}}\n`)})

  const stderr = output.stderr.toString('utf8').split('\n').map(it => it.trim()).filter(line => line.length > 0)
  stderr.forEach(line => { process.stderr.write(chalk`  {dim.inverse   {bgRed ⨉} ${line}}\n`)})
}

function buildCommand(parts: TemplateStringsArray, expressions: Bun.ShellExpression[]) {
  let out: string = ''

  const fmt = (expr: unknown): string | undefined => {
    if (isPlainObject(expr) && 'raw' in expr && typeof expr.raw === 'string') {
      return expr.raw
    } else if (typeof expr === 'string' || typeof expr === 'number') {
      return $.escape(expr.toString())
    } else if (typeof expr === 'boolean') {
      return expr ? 'true' : 'false'
    } else if (Array.isArray(expr)) {
      return expr.map(fmt).join(' ')
    } else {
      return `${expr}`
    }
  }

  for (let i = 0; i < parts.length; i++) {
    out += parts[i].replace(/\s+/g, ' ')
    if (i < expressions.length) {
      const arg = fmt(expressions[i])
      if (arg != null) {
        out += arg.trim().replace(/^\s+|\s+$/, ' ')
      }
    }
  }
  return out
}


export interface ShellOptions {
  verbose?: boolean
}