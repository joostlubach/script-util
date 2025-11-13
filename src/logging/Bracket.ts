import chalk from 'chalk'
import { cleanup } from 'script-util'

import { Spinner } from './Spinner'

/**
 * Groups together output for a single comprehensive task into a visually appealing bracket.
 */
export class Bracket {

  constructor(
    private readonly out: (line: string) => void,
    private readonly header: string,
    spinner: Spinner | undefined,
    private readonly options: BracketOptions = {}
  ) {
    if (!options.buffered) {
      this.printHeader()
      this.capture()
    }

    this.spinner = options.spinner ? spinner : undefined
  }

  /** Keeps a list of buffered chunks (in the case of options.buffered == true) */
  private chunks: string[] = []

  private readonly spinner: Spinner | undefined

  // #region Factory

  public static stdout(header: string, options: BracketOptions = {}) {
    return new Bracket(
      line => process.stdout.write(line),
      header,
      new Spinner(process.stdout),
      {
        capture: process.stdout,
        ...options,
      }
    )
  }

  public static stderr(header: string, options: BracketOptions = {}) {
    return new Bracket(
      line => process.stderr.write(line),
      header,
      new Spinner(process.stderr),
      {
        capture: process.stderr,
        ...options,
      }
    )
  }

  // #endregion

  // #region

  /**
   * Convenience function that ensures the bracket is finalized (closed) after use.
   */
  public async using<T>(fn: (bracket: Bracket) => Promise<T>): Promise<T> {
    try {
      return await fn(this)
    } finally {
      this.finalize()
    }
  }

  // Each tmpdir cleans up after itself when `.using()` is used, but in the case of a hard kill or interruption,
  // make sure it's cleaned up as well.
  // Note that cleanups have to be sync.
  private readonly _detachCleanup = cleanup(() => { this.finalize() })

  // #endregion

  // #region Capturing

  // Capturing ensures that all output sent to stdout/stderr is kept visually within the current bracket.
  //
  // Note: this.capture() and this.release() are idempotent.

  private originalWrite: ((chunk: any, encoding?: any, callback?: any) => boolean) | undefined
  private capturedWrite: ((chunk: any, encoding?: any, callback?: any) => boolean) | undefined

  private capture() {
    const stream = this.options.capture
    if (stream == null) { return () => {} }

    let newline: boolean = true

    const original = this.originalWrite ??= stream.write
    this.capturedWrite ??= ((chunk: Uint8Array | string, encoding?: BufferEncoding, callback?: any) => {
      // Split the text into lines, keeping the newline at the end of each line.
      let text = chunk.toString()
      const lines: string[] = []
      while (text.length > 0) {
        const nlpos = text.indexOf('\n')
        if (nlpos < 0) {
          lines.push(text)
          break
        }
        
        lines.push(text.slice(0, nlpos + 1))
        text = text.slice(nlpos + 1)
      }

      lines.forEach(line => {
        if (newline) {
          original.call(stream, this.bodyGlyph)
        }
        original.call(stream, line)
        newline = line.endsWith('\n')
      })

      return true
    })

    stream.write = this.capturedWrite
  }

  private release() {
    const stream = this.options.capture
    if (stream == null) { return }
    if (this.originalWrite == null) { return }

    stream.write = this.originalWrite
  }

  // #endregion

  // #region Interface

  /**
   * Writes chunks to the bracket. If `options.buffered` is set to `false`, this is essentially the same as
   * writing to the output stream directly.
   */
  public write(...chunks: string[]) {
    if (this.options.buffered) {
      this.chunks.push(...chunks)
      return
    }

    const spinnerWasRunning = this.spinner?.isRunning
    if (spinnerWasRunning) {
      this.spinner?.stop()
      this.out('\n')
    }

    const lastChunk = chunks[chunks.length - 1]
    const lastChar = lastChunk[lastChunk.length - 1]
    if (lastChar === '\n' && spinnerWasRunning) {
      chunks[chunks.length - 1] = lastChunk.slice(0, -1)
    }

    chunks.forEach(it => this.out(it))

    if (spinnerWasRunning) {
      this.spinner.start()
    }
  }

  /**
   * Writes one or more lines. This ensures that all given strings are suffixed with a newline.
   * @param raw The raw lines.
   */
  public line(...raw: string[]) {
    let lines = raw.length === 0 ? [''] : raw.flatMap(it => it.split('\n'))
    this.write(...lines.map(it => `${it}\n`))
  }

  /**
   * Convenience method to display a line with a spinner at the end. The spinner is removed either
   * the next time `.task()` is called, or when `.finalize()` is called.
   * @param description The task description (the line contents).
   */
  public task(description: string) {
    this.endTask()
    if (this.spinner != null) {
      this.write(chalk`{bold {cyan •} ${description}}`)
      this.write(' ')
      this.spinner.start()
    } else {
      this.line(chalk`{bold {cyan •} ${description}}`)
    }
  }

  private endTask() {
    const wasRunning = this.spinner?.isRunning
    this.spinner?.stop()
    if (wasRunning) {
      this.write('\n')
    }
  }


  /**
   * Closes the bracket and releases any captured output. Make sure to call this method, or use `.using()` to
   * ensure proper finalization.
   */
  public finalize() {
    this._detachCleanup()
    if (this.options.buffered) {
      this.printHeader()

      this.capture()
      this.chunks.forEach(it => this.out(it))
    }

    this.endTask()
    this.release()
    this.printFooter()
  }

  // #endregion

  // #region Low level printing

  private printHeader() {
    this.line(chalk`${this.headerGlyph}{bold ${this.header}}`)
    for (const detail of this.options.details ?? []) {
      this.line(chalk`${this.bodyGlyph}{dim ${detail}}`)
    }
    this.line(this.bodyGlyph)
  }

  private printFooter() {
    this.line(this.bodyGlyph)
    this.out(chalk`${this.footerGlyph}/${this.header}\n`)
  }

  private get headerGlyph() {
    return this.glyph('╭─ ')
  }

  private get bodyGlyph() {
    return this.glyph('│  ')
  }

  private get footerGlyph() {
    return this.glyph('╰─ ')
  }

  private glyph(str: string) {
    if (this.options.color != null) {
      return chalk.hex(this.options.color)(str)
    } else {
      return str
    }
  }

  // #endregion

}

export interface BracketOptions {
  buffered?: boolean
  details?: string[]

  capture?: NodeJS.WriteStream
  spinner?: boolean

  color?: string
}