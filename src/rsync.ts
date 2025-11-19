import { Shell } from './shell'
import { SSHShell } from './ssh'

export async function rsync($: Shell | SSHShell, source: string, destination: string, options: RSyncOptions = {}) {
  return $`rsync \
    -ruvaz \
    ${options.delete ? '--delete' : []} \
    ${options.exclude?.flatMap(it => ['--exclude', it]) ?? []} \
    ${options.proxy != null ? ['-e', `ssh -J ${options.proxy}`] : []} \
    ${source} \
    ${destination}`
}

export interface RSyncOptions {
  delete?: boolean
  exclude?: string[]
  transform?: (path: string, tmpdest: string) => Promise<void>
  proxy?: string
}