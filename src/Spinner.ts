

export class Spinner {
  private timer: NodeJS.Timeout | null = null
  private frames = ['-', '\\', '|', '/']
  private currentFrame = 0

  public start() {
    if (this.timer != null) { return }

    this.timer = setInterval(() => {
      process.stderr.write(`${this.frames[this.currentFrame]}\b`)
      this.currentFrame = (this.currentFrame + 1) % this.frames.length
    }, 100)
  }

  public stop() {
    if (this.timer == null) { return }
    clearInterval(this.timer)
    this.timer = null
  }
}