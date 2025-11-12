import * as fs from 'fs-extra'
import { glob } from 'glob-promise'
import * as os from 'os'
import * as path from 'path'
import { rsync } from 'script-util'

import { cleanup } from './cleanup'
import { RSyncOptions } from './rsync'
import { Shell } from './shell'

export class TmpDir {

  private constructor(
    public readonly dir: string,
    private readonly options: TmpDirOptions
  ) {
    // Each tmpdir cleans up after itself when `.using()` is used, but in the case of a hard kill or interruption,
    // make sure it's cleaned up as well.
    // Note that cleanups have to be sync.
    cleanup(() => { this.disposeSync() })
  }

  // #region Lifecycle

  public static async using<T>(fn: (dir: TmpDir) => T | Promise<T>): Promise<T>
  public static async using<T>(options: TmpDirOptions, fn: (dir: TmpDir) => T | Promise<T>): Promise<T>
  public static async using(...args: any[]) {
    const fn = args.pop() as ((dir: TmpDir) => any | Promise<any>)
    const options = args.shift() ?? {} as TmpDirOptions

    const dir = await this.create(options)
    try {
      return await fn(dir)
    } finally {
      await dir.dispose()
    }
  }

  public static async create(options: TmpDirOptions = {}) {
    const dir = await fs.mkdtemp(os.tmpdir() + '/')
    return new TmpDir(dir, options)
  }

  public async dispose() {
    if (this.options.leave) { return }
    try {
      await fs.rmdir(this.dir)
    } catch {}
  }

  public disposeSync() {
    if (this.options.leave) { return }
    try {
      fs.rmdirSync(this.dir)
    } catch {}
  }

  // #endregion

  // #region Paths

  public path(file: string) {
    return path.join(this.dir, file)
  }

  // #endregion

  // #region Copying

  public async copyFrom(dir: string, options: CopyFromOptions = {}) {
    const prefix = dir.replace(/\/+$/, '')
    const files = await glob.glob(`${prefix}/**`)
    const promises = files.map(async source => {
      const relpath = source.slice(prefix.length)
      const dest = path.join(this.dir, relpath)
      if (options.transform != null) {
        await options.transform(source, dest)
      } else {
        await fs.copy(source, dest)
      }
    })
    await Promise.all(promises)
  }

  public async rsyncTo($: Shell, dest: string, options: RSyncOptions = {}) {
    return await rsync($, this.dir, dest, options)
  }

  // #endgion

}

export interface TmpDirOptions {
  leave?: boolean
}

export interface CopyFromOptions {
  transform?: (source: string, destination: string) => Promise<void>
}