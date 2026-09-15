import { describe, expect, it, vi } from 'vitest';

import { runWorkerLoop } from '../src/index.js';

describe('analytics worker loop', () => {
  it('stops processing after its abort signal is raised', async () => {
    const controller = new AbortController();
    const worker = {
      processNextBatch: vi.fn(async () => {
        controller.abort();
        return 0;
      }),
    };

    await expect(
      runWorkerLoop(worker, controller.signal),
    ).resolves.toBeUndefined();
    expect(worker.processNextBatch).toHaveBeenCalledOnce();
  });

  it('propagates processing failures', async () => {
    const worker = {
      processNextBatch: vi.fn(async () => {
        throw new Error('database unavailable');
      }),
    };

    await expect(
      runWorkerLoop(worker, new AbortController().signal),
    ).rejects.toThrow('database unavailable');
  });
});
