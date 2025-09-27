import { $ } from 'bun'
import chalk from 'chalk'

import { Spinner } from './Spinner'

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
            spinner?.stop();
            if ($verbose) {
              logShellOutput(output);
            }
            return onfulfilled != null ? onfulfilled(output) : output
          },
          error => {
            spinner?.stop();

            if (!commandLogged) {
              process.stderr.write(chalk`{red ⨉} Shell command failed:\n`)
              logShellCommand(parts, expressions)
            }

            const output = error instanceof $.ShellError ? error : null
            logShellOutput(output);
            process.exit(1)
          }
        )
      }
    })

    return promise
  }

  Object.assign($$, $)

  Object.assign($$, {
    verbose: (verbose?: boolean) => {
      if (verbose != null) {
        $verbose = verbose
      } else {
        return $verbose
      }
    }
  })

  return $$ as Shell
}

export type Shell = typeof $ & {
  verbose(verbose: boolean): void
  verbose(): boolean
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
  for (let i = 0; i < parts.length; i++) {
    out += parts[i]
    if (i < expressions.length) {
      const expr = expressions[i]
      if (typeof expr === 'string' || typeof expr === 'number') {
        out += `'${expr.toString().replace(/'/g, `'\\''`)}'`
      } else if (typeof expr === 'boolean') {
        out += expr ? 'true' : 'false'
      } else {
        out += `${expr}`
      }
    }
  }
  return out
}


export interface ShellOptions {
  verbose?: boolean
}