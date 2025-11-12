export class Spinner {

  constructor(
    private readonly stream: NodeJS.WriteStream
  ) {}

  private timer: NodeJS.Timeout | null = null
  private frames = ['-', '\\', '|', '/']
  private currentFrame = 0

  public get isRunning() {
    return this.timer != null
  }

  public start() {
    if (this.timer != null) { return }

    this.timer = setInterval(() => {
      this.stream.write(`${this.frames[this.currentFrame]}\b`)
      this.currentFrame = (this.currentFrame + 1) % this.frames.length
    }, 100)
  }

  public stop() {
    if (this.timer == null) { return }
    clearInterval(this.timer)
    this.stream.write('\x1b[P')
    this.timer = null
  }

}