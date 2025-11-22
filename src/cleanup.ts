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
  file,
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

process.on('SIGINT', () => {
  cleanupNow()
  process.exit(130) // 128 + 2 (SIGINT)
})
process.on('SIGTERM', () => {
  cleanupNow()
  process.exit(143) // 128 + 15 (SIGTERM)
})
process.on('SIGHUP', () => {
  cleanupNow()
  process.exit(129) // 128 + 1 (SIGHUP)
})
process.on('SIGQUIT', () => {
  cleanupNow()
  process.exit(131) // 128 + 3 (SIGQUIT)
})
process.on('exit', cleanupNow) 