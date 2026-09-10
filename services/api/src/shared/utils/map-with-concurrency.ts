// src/shared/utils/map-with-concurrency.ts

/**
 * Map over items with a bounded number of in-flight operations.
 *
 * `Promise.all(items.map(...))` starts every operation at once. On a page of
 * media that is one gRPC presign per private file, all issued in the same tick,
 * which is how a single admin list request can open a hundred concurrent calls
 * to the file service.
 *
 * Results keep the input order regardless of completion order. Rejections
 * propagate like Promise.all: the first rejection is thrown, and no further
 * items are started.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) return [];

  const maxInFlight = Math.max(1, Math.min(Math.trunc(limit), items.length));
  const results = new Array<R>(items.length);
  let next = 0;

  const worker = async (): Promise<void> => {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index], index);
    }
  };

  await Promise.all(Array.from({ length: maxInFlight }, worker));

  return results;
}
