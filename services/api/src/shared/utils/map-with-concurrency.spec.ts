// src/shared/utils/map-with-concurrency.spec.ts
import { mapWithConcurrency } from './map-with-concurrency';

describe('mapWithConcurrency', () => {
  it('returns results in input order regardless of completion order', async () => {
    const delays = [30, 0, 10, 20];

    const result = await mapWithConcurrency(delays, 2, async (delay, index) => {
      await new Promise((resolve) => setTimeout(resolve, delay));
      return index;
    });

    expect(result).toEqual([0, 1, 2, 3]);
  });

  it('never runs more than `limit` operations at once', async () => {
    let inFlight = 0;
    let peak = 0;

    await mapWithConcurrency(Array.from({ length: 50 }, (_, i) => i), 5, async () => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 1));
      inFlight -= 1;
    });

    expect(peak).toBe(5);
  });

  it('returns an empty array without calling the mapper', async () => {
    const fn = jest.fn();

    await expect(mapWithConcurrency([], 4, fn)).resolves.toEqual([]);
    expect(fn).not.toHaveBeenCalled();
  });

  it('propagates the first rejection and stops starting new items', async () => {
    const started: number[] = [];

    await expect(
      mapWithConcurrency([1, 2, 3, 4, 5, 6], 1, async (item) => {
        started.push(item);
        if (item === 2) throw new Error('boom');
        return item;
      }),
    ).rejects.toThrow('boom');

    expect(started).toEqual([1, 2]);
  });

  it('treats a limit below 1 as a single worker', async () => {
    let inFlight = 0;
    let peak = 0;

    await mapWithConcurrency([1, 2, 3], 0, async () => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 1));
      inFlight -= 1;
    });

    expect(peak).toBe(1);
  });
});
