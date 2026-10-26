import { describe, expect, it } from 'vitest'
import { runWithConcurrency } from './concurrency'

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((r) => (resolve = r))
  return { promise, resolve }
}

const tick = () => new Promise((r) => setTimeout(r, 0))

describe('runWithConcurrency', () => {
  it('동시에 limit개까지만 돌리고 끝나는 대로 다음 것을 시작한다', async () => {
    const gates = [0, 1, 2, 3, 4].map(() => deferred())
    const started: number[] = []
    let running = 0
    let maxRunning = 0
    const done = runWithConcurrency([0, 1, 2, 3, 4], 3, async (i) => {
      started.push(i)
      running += 1
      maxRunning = Math.max(maxRunning, running)
      await gates[i].promise
      running -= 1
    })
    await tick()
    expect(started).toEqual([0, 1, 2])
    gates[1].resolve()
    await tick()
    expect(started).toEqual([0, 1, 2, 3])
    gates.forEach((g) => g.resolve())
    await done
    expect(started).toEqual([0, 1, 2, 3, 4])
    expect(maxRunning).toBe(3)
  })

  it('취소되면 아직 시작하지 않은 것은 시작하지 않는다', async () => {
    const controller = new AbortController()
    const started: number[] = []
    await runWithConcurrency(
      [0, 1, 2, 3],
      1,
      async (i) => {
        started.push(i)
        if (i === 1) controller.abort()
      },
      controller.signal,
    )
    expect(started).toEqual([0, 1])
  })

  it('할 일이 없으면 바로 끝난다', async () => {
    await expect(runWithConcurrency([], 3, async () => {})).resolves.toBeUndefined()
  })
})
