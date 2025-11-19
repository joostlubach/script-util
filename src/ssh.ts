import { isArray } from 'lodash'

import { Shell } from './shell'

export function createSSHShell(
  $: Shell,
  remote: string,
  options?: SSHShellOptions
): SSHShell {
  const defaultTTY = options?.tty ?? process.stdout.isTTY
  const sshArgs = options?.sshArgs ?? []
  
  let defaultEnv: EnvMap = {}
  let defaultCWD: string | undefined = undefined
  let proxy: string | null = options?.proxy ?? null

  const $$ = ((strings: TemplateStringsArray, ...exprs: any[]) => {
    let env: EnvMap = {...defaultEnv}
    let cwd: string | undefined = defaultCWD
    let tty: boolean = defaultTTY
    let quiet: boolean = false
    let shouldThrow: boolean | undefined = undefined
    let sync: boolean = false

    function buildCmd() {
      let cmd = ''
      for (let i = 0; i < strings.length; i++) {
        cmd += strings[i]
        if (i < exprs.length) {
          const expr = exprs[i]
          if (isArray(expr)) {
            cmd += expr.map(it => $.escape(it)).join(' ')
          } else {
            cmd += $.escape(expr)
          }
        }
      }

      return cmd
    }

    function buildPrefix() {
      let prefix = ''
      if (cwd) {
        prefix += `cd ${$.escape(cwd)} && `
      }

      if (Object.keys(env).length > 0) {
        for (const [k, v] of Object.entries(env)) {
          prefix += `${k}=${$.escape(String(v))} `
        }
      }

      return prefix
    }

    function buildSSHFlags() {
      const sshFlags: string[] = []

      if (tty) {
        sshFlags.push('-t')
      }
      if (proxy) {
        sshFlags.push('-J', proxy)
      }
      sshFlags.push(...sshArgs)

      return sshFlags
    }

    function run(): Bun.$.ShellPromise {
      const sshFlags = buildSSHFlags()
      const prefix = buildPrefix()
      const cmd = buildCmd()

      let retval = $`ssh ${sshFlags} ${remote} ${prefix + cmd}`
      if (quiet) {
        retval = retval.quiet()
      }
      if (shouldThrow !== undefined) {
        retval = retval.throws(shouldThrow)
      }
      
      return retval
    }

    function runSync() {
      const sshFlags = buildSSHFlags()
      const prefix = buildPrefix()
      const cmd = buildCmd()
      return Bun.spawnSync({
        cmd: ['ssh', ...sshFlags, remote, prefix + cmd]
      })
    }

    // Make result thenable / promise-like so it's awaitable and also chainable with .withEnv/.withCwd
    const promise: SSHShellPromise = {

      // Options & flags

      env(value?: EnvMap) {
        env = {...env, ...value}
        return this
      },

      cwd(value?: string) {
        cwd = value
        return this
      },

      quiet() {
        quiet = true
        return this
      },

      throws(shouldThrow: boolean) {
        shouldThrow = shouldThrow
        return this
      },

      nothrow() {
        shouldThrow = false
        return this
      },

      // Output accessors.

      get stdin() { return run().stdin },
      get lines() { return run().lines },
      text() { return run().text() },
      json() { return run().json() },
      arrayBuffer() { return run().arrayBuffer() },
      blob() { return run().blob() },
      sync() { return runSync() },

      // Promise interface
      
      then(onfulfilled?: any, onrejected?: any) {
        return run().then(onfulfilled, onrejected)
      },
      catch(onrejected?: any) {
        return run().catch(onrejected)
      },
      finally(onfinally?: any) {
        return run().finally(onfinally)
      },

      // Misc

      get [Symbol.toStringTag]() {
        return run()[Symbol.toStringTag]
      }
    }

    return promise
  }) as SSHShell

  $$.env = function (value?: EnvMap) {
    defaultEnv = {...defaultEnv, ...value}
    return this
  }
  $$.cwd = function (value?: string) {
    defaultCWD = value
    return this
  }
  $$.proxy = function (value: string | null) {
    proxy = value
    return this
  }

  $$.test = async function (strings: TemplateStringsArray, ...expressions: Bun.ShellExpression[]) {
    const {exitCode} = await $$(strings, ...expressions).nothrow()
    return exitCode === 0
  }

  return $$
}

type EnvMap = Record<string, string | undefined>

export interface SSHShell {
  (strings: TemplateStringsArray, ...expressions: Bun.ShellExpression[]): SSHShellPromise
  test(strings: TemplateStringsArray, ...expressions: Bun.ShellExpression[]): Promise<boolean>

  braces(pattern: string): string[]
  escape(input: string): string
  
  env(newEnv?: Record<string, string | undefined> | NodeJS.Dict<string> | undefined): SSHShell
  cwd(newCwd?: string): SSHShell
  proxy(value: string | null): SSHShell
  nothrow(): SSHShell
  throws(shouldThrow: boolean): SSHShell
}
export type SSHShellPromise = {
  [K in keyof Bun.$.ShellPromise]: 
    Bun.$.ShellPromise[K] extends ((...args: infer A extends any[]) => Bun.$.ShellPromise)
      ? ((...args: A) => SSHShellPromise)
      : Bun.$.ShellPromise[K]
} & {
  sync: () => Bun.SyncSubprocess<"pipe", "pipe">
}

export interface SSHShellOptions {
  tty?: boolean
  sshArgs?: string[]
  proxy?: string
}