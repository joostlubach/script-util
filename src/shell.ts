import { $ } from 'bun'
import chalk from 'chalk'
import { isPlainObject } from 'ytil'

import { Spinner } from './logging/Spinner'
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
          spinner = new Spinner(process.stderr)
          spinner.start()
        }
        return orig_then.call(
          promise,
          (output: $.ShellOutput) => {
            spinner?.stop()
            if ($verbose) {
              logShellOutput(output)
            }
            return onfulfilled != null ? onfulfilled(output) : output
          },
          (error: $.ShellError) => {
            spinner?.stop()

            if (!commandLogged) {
              process.stderr.write(chalk`{red ⨉} Shell command failed:\n`)
              logShellCommand(parts, expressions)
            }

            const output = error instanceof $.ShellError ? error : null
            logShellOutput(output, -50)
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

  $$.test = async function (strings: TemplateStringsArray, ...expressions: Bun.ShellExpression[]) {
    const {exitCode} = await $$(strings, ...expressions).nothrow()
    return exitCode === 0
  }
  
  return $$ as Shell
}

export type Shell = typeof $ & {
  verbose(verbose: boolean): void
  verbose(): boolean

  ssh(remote: string, options?: SSHShellOptions): SSHShell
  test(parts: TemplateStringsArray, ...expressions: Bun.ShellExpression[]): Promise<boolean>
}

function logShellCommand(parts: TemplateStringsArray, expressions: Bun.ShellExpression[]) {
  const command = buildCommand(parts, expressions)
  process.stderr.write(chalk`  $ ${command}`)
}

function logShellOutput(output: $.ShellOutput | null, tail?: number) {
  if (output == null) {
    process.stderr.write('\n')
    return
  }

  const formattedExitCode = output.exitCode === 0 ? chalk`{bgGreen  0 }` : chalk`{bgRed  ${output.exitCode} }`
  process.stderr.write(chalk` ${formattedExitCode}\n`)

  const stdout = output.stdout.toString('utf8').split('\n').map(it => it.trim()).filter(line => line.length > 0)
  stdout.slice(tail).forEach(line => { process.stderr.write(chalk`  {dim   ${line}}\n`)})

  const stderr = output.stderr.toString('utf8').split('\n').map(it => it.trim()).filter(line => line.length > 0)
  stderr.slice(tail).forEach(line => { process.stderr.write(chalk`  {dim   {bgRed ⨉} ${line}}\n`)})
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