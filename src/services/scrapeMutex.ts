/** Serializes scrape runs so cron, Discord, and scripts do not overlap. */
export class ScrapeMutex {
  private lock: Promise<void> = Promise.resolve();
  private running = false;

  get isInProgress(): boolean {
    return this.running;
  }

  async run<T>(fn: () => Promise<T>): Promise<T> {
    let releaseLock!: () => void;
    const waitForLock = this.lock;
    this.lock = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });
    await waitForLock;

    this.running = true;
    try {
      return await fn();
    } finally {
      this.running = false;
      releaseLock();
    }
  }
}

export const defaultScrapeMutex = new ScrapeMutex();
