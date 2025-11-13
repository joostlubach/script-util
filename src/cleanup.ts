import chalk from 'chalk'
import * as fs from 'fs'

const ROUTINES = new Set<() => void>()

function cleanup(routine: () => void) {
  ROUTINES.add(routine)
  return () => {
    ROUTINES.delete(routine)
  }
}

function file(path: string) {
  return cleanup(() => {
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
process.on('exit', cleanupNow) 