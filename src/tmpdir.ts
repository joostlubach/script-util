import * as fs from 'fs-extra'
import { glob } from 'glob-promise'
import * as os from 'os'
import * as path from 'path'
import { rsync } from 'script-util'
import { isObject } from 'ytil'

import { cleanup } from './cleanup'
import { RSyncOptions } from './rsync'
import { Shell } from './shell'

export class TmpDir {

  private constructor(
    public readonly dir: string,
    private readonly options: TmpDirOptions
  ) {}

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

  // Each tmpdir cleans up after itself when `.using()` is used, but in the case of a hard kill or interruption,
  // make sure it's cleaned up as well.
  // Note that cleanups have to be sync.
  private readonly _detachCleanup = cleanup(() => { this.disposeSync() })

  public async dispose() {
    this._detachCleanup()

    const {leave = process.env.TMPDIR_LEAVE === '1'} = this.options
    if (leave) { return }

    try {
      await fs.rmdir(this.dir)
    } catch {}
  }

  public disposeSync() {
    this._detachCleanup()

    const {leave = process.env.TMPDIR_LEAVE === '1'} = this.options
    if (leave) { return }

    try {
      fs.rmSync(this.dir, {
        recursive: true
      })
    } catch {}
  }

  // #endregion

  // #region Paths

  public path(file: string) {
    return path.join(this.dir, file)
  }

  public async fileExists(file: string) {
    const path = this.path(file)
    
    try {
      const stat = await fs.stat(path)
      return stat.isFile()
    } catch (error) {
      if (isObject(error) && 'code' in error && error.code === 'ENOENT') {
        return false
      } else {
        throw error
      }
    }
  }

  // #endregion

  // #region Copying

  public async copyFrom(dir: string, options: CopyFromOptions = {}) {
    const prefix = dir.replace(/\/+$/, '')
    const files = await glob.glob(`${prefix}/**`, {dot: true, nodir: true})
    const promises = files.map(async source => {
      const relpath = source.slice(prefix.length + 1)

      const dest = path.join(this.dir, relpath)
      options.callback?.(relpath, source, dest)

      await fs.ensureDir(path.dirname(dest))
      const transformed = await options.transform?.(relpath, source, dest)
      if (!transformed) {
        await fs.copy(source, dest)
      }
    })
    await Promise.all(promises)
  }

  public async rsyncTo($: Shell, dest: string, options: RSyncOptions = {}) {
    return await rsync($, `${this.dir}/`, dest, options)
  }

  // #endregion

}

export interface TmpDirOptions {
  leave?: boolean
}

export interface CopyFromOptions {
  callback?: (relpath: string, source: string, destination: string) => void
  transform?: (relpath: string, source: string, destination: string) => Promise<true | undefined>
}