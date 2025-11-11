import { Shell } from './shell'

export async function rsync($: Shell, source: string, destination: string, options: RSyncOptions = {}) {
  return $`rsync \
    -ruvaz \
    ${options.delete ? '--delete' : []} \
    ${options.exclude?.flatMap(it => ['--exclude', it])} \
    ${source} \
    ${destination}`
}

export interface RSyncOptions {
  delete?: boolean
  exclude?: string[]
  transform?: (path: string, tmpdest: string) => Promise<void>
}