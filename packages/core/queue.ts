/**
 * Single-Writer Execution Queue (P1.1, Section 3.1)
 * Guarantees that no concurrent operations can execute or mutate state simultaneously.
 */

export class SingleWriterQueue {
  private queue: Promise<unknown> = Promise.resolve();
  private running = false;

  get isRunning(): boolean {
    return this.running;
  }

  async execute<T>(task: () => Promise<T>): Promise<T> {
    const runTask = async (): Promise<T> => {
      this.running = true;
      try {
        return await task();
      } finally {
        this.running = false;
      }
    };

    const next = this.queue.then(runTask, runTask);
    this.queue = next;
    return next;
  }
}
