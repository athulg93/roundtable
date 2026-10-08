/**
 * Single-Writer Concurrency Tests (P1.1, Section 8.3)
 */

import { describe, it, expect } from 'vitest';
import { SingleWriterQueue } from '../../packages/core/queue.ts';

describe('Single-Writer Queue Concurrency', () => {
  it('serializes overlapping asynchronous calls strictly in order', async () => {
    const queue = new SingleWriterQueue();
    const executionLog: string[] = [];

    const task1 = () =>
      queue.execute(async () => {
        executionLog.push('start-1');
        await new Promise((r) => setTimeout(r, 40));
        executionLog.push('end-1');
        return 'res1';
      });

    const task2 = () =>
      queue.execute(async () => {
        executionLog.push('start-2');
        await new Promise((r) => setTimeout(r, 10));
        executionLog.push('end-2');
        return 'res2';
      });

    const task3 = () =>
      queue.execute(async () => {
        executionLog.push('start-3');
        await new Promise((r) => setTimeout(r, 5));
        executionLog.push('end-3');
        return 'res3';
      });

    // Fire all 3 concurrently
    const [r1, r2, r3] = await Promise.all([task1(), task2(), task3()]);

    expect(r1).toBe('res1');
    expect(r2).toBe('res2');
    expect(r3).toBe('res3');

    // Confirm strict serial ordering: task1 must completely finish before task2 starts
    expect(executionLog).toEqual([
      'start-1',
      'end-1',
      'start-2',
      'end-2',
      'start-3',
      'end-3',
    ]);
  });
});
