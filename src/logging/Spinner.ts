export class Spinner {

  constructor(
    private readonly stream: NodeJS.WriteStream
  ) {}

  private timer: NodeJS.Timeout | null = null
  private frames = ['-', '\\', '|', '/']
  private currentFrame = 0

  private _writing: boolean = false
  private _writeOnStop: string | undefined = undefined

  public writeOnStop(): string
  public writeOnStop(value: string): void
  public writeOnStop(value?: string) {
    if (value === undefined) {
      return this._writeOnStop
    } else {
      this._writeOnStop = value
    }
  }

  public get isRunning() {
    return this.timer != null
  }

  public get isWriting() {
    return this._writing
  }

  public start() {
    if (this.timer != null) { return }

    this.timer = setInterval(() => {
      if (this.timer == null) { return }
      this._writing = true
      this.stream.write(`${this.frames[this.currentFrame]}\b`)
      this._writing = false
      this.currentFrame = (this.currentFrame + 1) % this.frames.length
    }, 100)
  }

  public stop() {
    if (this.timer == null) { return }
    clearInterval(this.timer)
    this._writing = true
    this.stream.write('\x1b[P')
    if (this._writeOnStop) {
      this.stream.write(this._writeOnStop)
    }
    this._writing = false
    this._writeOnStop = undefined
    this.timer = null
  }

}