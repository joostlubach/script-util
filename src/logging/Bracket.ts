import chalk from 'chalk'
import { range } from 'lodash'

import { Spinner } from './Spinner'

/**
 * Groups together output for a single comprehensive task into a visually appealing bracket.
 */
export class Bracket {

  constructor(
    private readonly out: (line: string) => void,
    private readonly header: string,
    private readonly taskSpinner: Spinner | undefined,
    private readonly options: BracketOptions = {}
  ) {
    const isInteractiveTty = this.options.capture?.isTTY ?? false
    const useTaskSpinner = options.taskSpinner !== false && isInteractiveTty
    this.taskSpinner = useTaskSpinner ? undefined : taskSpinner
  }

  private currentTask: boolean = false

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
    this.printHeader()
    this.capture()
    this.line()
    try {
      return await fn(this)
    } finally {
      this.finalize()
    }
  }

  /**
   * Convenience function that ensures the bracket is finalized (closed) after use.
   */
  public usingSync<T>(fn: (bracket: Bracket) => T): T {
    try {
      return fn(this)
    } finally {
      this.finalize()
    }
  }

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
    this.capturedWrite ??= ((chunk: Uint8Array | string) => {
      if (chunk instanceof Uint8Array) {
        original.call(stream, chunk)
        return true
      }

      // If there is currently a spinner running, stop it.
      const spinnerRunning = !this.taskSpinner?.isWriting && this.taskSpinner?.isRunning
      if (spinnerRunning) {
        this.taskSpinner.stop()
      }

      // Split the text into lines, keeping the newline at the end of each line.
      const lines: string[] = []
      while (chunk.length > 0) {
        const nlpos = chunk.indexOf('\n')
        if (nlpos < 0) {
          lines.push(chunk)
          break
        }
        
        lines.push(chunk.slice(0, nlpos + 1))
        chunk = chunk.slice(nlpos + 1)
      }

      lines.forEach(line => {
        if (newline) {
          original.call(stream, this.bodyGlyph)
        }
        original.call(stream, line)
        newline = line.endsWith('\n')
      })

      // Restart the spinner again if it was running.
      if (spinnerRunning) {
        this.taskSpinner.start()
      }

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
    chunks.forEach(it => this.out(it))
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
  public task(description: string, options: TaskOptions = {}) {
    this.taskSpinner?.stop()

    if (this.currentTask) {
      range(this.options.taskGap ?? 0).forEach(() => this.write('\n'))
    }

    this.currentTask = true
    this.write(chalk`{bold {cyan •} ${description}}`)

    const useSpinner = this.options.taskSpinner !== false && options.spinner !== false
    if (useSpinner && this.taskSpinner != null) {
      this.write(' ')

      // When the spinner is stopped, it will remove the space and move to a new line.
      this.taskSpinner.writeOnStop('\b\x1b[P\n')
      this.taskSpinner.start()
    } else {
      // Write the newline now.
      this.write('\n')
    }
  }

  /**
   * Closes the bracket and releases any captured output. Make sure to call this method, or use `.using()` to
   * ensure proper finalization.
   */
  public finalize() {
    this.taskSpinner?.stop()

    this.line()
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
  }

  private printFooter() {
    this.out(chalk`${this.footerGlyph}/\n`)
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
      return chalk.hex(this.options.color).bold(str)
    } else {
      return chalk.bold(str)
    }
  }

  // #endregion

}

export interface BracketOptions {
  details?: string[]

  capture?: NodeJS.WriteStream
  
  taskSpinner?: boolean
  taskGap?: number

  color?: string
}

export interface TaskOptions {
  spinner?: boolean
}