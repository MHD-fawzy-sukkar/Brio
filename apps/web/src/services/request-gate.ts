/** Prevent duplicate clicks synchronously, before React can render the disabled state. */
export class RequestGate {
  private pending = false;
  private nextAt = 0;
  constructor(
    private readonly intervalMs = 1000,
    private readonly now = () => Date.now(),
  ) {}
  start(): boolean {
    if (this.pending || this.now() < this.nextAt) return false;
    this.pending = true;
    this.nextAt = this.now() + this.intervalMs;
    return true;
  }
  finish(): void {
    this.pending = false;
  }
}
