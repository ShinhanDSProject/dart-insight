/**
 * 할 일을 한 번에 limit개까지만 돌린다. 끝나는 대로 다음 것을 시작하고, 모두 끝나면 끝난다.
 * signal이 취소되면 아직 시작하지 않은 것은 시작하지 않는다. 각 할 일의 실패는 할 일 안에서 처리한다.
 */
export async function runWithConcurrency<T>(
  items: readonly T[],
  limit: number,
  task: (item: T) => Promise<void>,
  signal?: AbortSignal,
): Promise<void> {
  let next = 0
  async function worker(): Promise<void> {
    while (next < items.length && !signal?.aborted) {
      const item = items[next]
      next += 1
      await task(item)
    }
  }
  const workers = Math.max(1, Math.min(limit, items.length))
  await Promise.all(Array.from({ length: workers }, worker))
}
