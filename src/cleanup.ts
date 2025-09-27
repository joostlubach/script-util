import chalk from 'chalk'
import * as fs from 'fs'
import { isPromise } from 'ytil'

const ROUTINES = new Set<() => void>()

function cleanup(routine: () => void) {
  ROUTINES.add(routine)
}

function file(path: string) {
  cleanup(() => {
      try {
        fs.unlinkSync(path)
      } catch (err) {}

  })
}

Object.assign(cleanup, {
  file
})

const cleanup_ = cleanup as typeof cleanup & {
  file: typeof file
}
export { cleanup_ as cleanup }


export function runWithCleanup<T>(fn: () => Promise<T>): Promise<T>
export function runWithCleanup<T>(fn: () => T): T
export function runWithCleanup<T>(fn: () => any) {
  try {
    const retval = fn()
    if (isPromise(retval)) {
      return retval.finally(cleanupNow)
    } else {
      return retval
    }
  } finally {
    cleanupNow()
  }
}

export function cleanupNow() {
  for (const routine of ROUTINES) {
    try {
      routine()
    } catch (err) {
      process.stderr.write(chalk`{yellow △} Cleanup routine failed: ${err}\n`)
    }
  }
  ROUTINES.clear()
}

process.on('SIGINT', cleanupNow)
process.on('SIGTERM', cleanupNow)
process.on('SIGHUP', cleanupNow)
process.on('SIGQUIT', cleanupNow)