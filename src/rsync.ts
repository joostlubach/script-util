import { Shell } from './shell'
import { SSHShell } from './ssh'

export async function rsync($: Shell | SSHShell, source: string, destination: string, options: RsyncOptions = {}) {
  const hostKeyVerification = options.hostKeyVerification ?? false
  
  const sshFlags: string[] = []
  if (options.proxy != null) {
    sshFlags.push('-J', options.proxy)
  }
  if (!hostKeyVerification) {
    sshFlags.push('-o', 'StrictHostKeyChecking=no')
    sshFlags.push('-o', 'UserKnownHostsFile=/dev/null')
  }

  return $`rsync \
    -ruvaz \
    ${options.delete ? '--delete' : []} \
    ${options.exclude?.flatMap(it => ['--exclude', it]) ?? []} \
    ${sshFlags.length > 0 ? ['-e', `ssh ${sshFlags.join(' ')}`] : []} \
    ${source} \
    ${destination}`
}

export interface RsyncOptions {
  delete?: boolean
  exclude?: string[]
  transform?: (path: string, tmpdest: string) => Promise<void>
  proxy?: string
  hostKeyVerification?: boolean
}