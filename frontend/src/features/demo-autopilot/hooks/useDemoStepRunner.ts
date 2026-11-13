import { useEffect, useRef, useState } from 'react'
import { match } from 'ts-pattern'
import type { DemoState } from '../model/demoState'
import { DEMO_TARGET_TIMEOUT_MS, type DemoAction, type DemoStep, type DemoTarget } from '../model/scenario'

export interface DemoCursor {
  x: number
  y: number
  /** 누르는 순간(짧게 줄어드는 표시) */
  pressing: boolean
}

interface StepRunnerOptions {
  state: DemoState
  steps: DemoStep[]
  onDone: () => void
  onFailed: (reason: string) => void
}

/** 커서가 한 곳으로 옮겨 가는 시간. demo-autopilot.css의 커서 transition과 같다 */
const CURSOR_MOVE_MS = 700
/** 글자 하나를 치는 간격 */
const TYPE_INTERVAL_MS = 110

/**
 * 시연 단계 실행기(#967). 상태가 running이 되면 그 단계의 동작을 차례로 실제 화면에 한다.
 * 찾을 요소는 선택자(와 글자)로 기다렸다가 쓰고, 끝내지 못하면 onFailed로 알린다. 시연을 끄면(언마운트) 멈춘다.
 */
export function useDemoStepRunner({ state, steps, onDone, onFailed }: StepRunnerOptions) {
  const [cursor, setCursor] = useState<DemoCursor | null>(null)
  const [spotlight, setSpotlight] = useState<HTMLElement | null>(null)
  const callbacks = useRef({ onDone, onFailed })
  useEffect(() => {
    callbacks.current = { onDone, onFailed }
  })

  const runningStep = state.status === 'running' ? state.step : null
  useEffect(() => {
    if (runningStep === null) return
    const step = steps[runningStep]
    const controller = new AbortController()
    const tools: DemoTools = { signal: controller.signal, setCursor, setSpotlight }
    setSpotlight(null)
    runActions(step.actions, tools).then(
      () => {
        if (!controller.signal.aborted) callbacks.current.onDone()
      },
      (error: unknown) => {
        if (controller.signal.aborted) return
        callbacks.current.onFailed(error instanceof DemoStepError ? error.message : '이 단계를 끝내지 못했어요.')
      },
    )
    return () => controller.abort()
  }, [runningStep, steps])

  return { cursor, spotlight }
}

interface DemoTools {
  signal: AbortSignal
  setCursor: (update: (cursor: DemoCursor | null) => DemoCursor | null) => void
  setSpotlight: (element: HTMLElement | null) => void
}

class DemoStepError extends Error {}

async function runActions(actions: DemoAction[], tools: DemoTools) {
  for (const action of actions) {
    if (tools.signal.aborted) return
    await runAction(action, tools)
  }
}

function runAction(action: DemoAction, tools: DemoTools): Promise<void> {
  return match(action)
    .with({ kind: 'wait' }, async ({ target, timeoutMs = DEMO_TARGET_TIMEOUT_MS, giveUpWhen, otherwise, failReason }) => {
      const until = Date.now() + timeoutMs
      while (queryVisible(target) === undefined) {
        const givenUp = Date.now() > until || (giveUpWhen !== undefined && queryVisible(giveUpWhen) !== undefined)
        if (givenUp && otherwise !== undefined) return runActions(otherwise, tools)
        if (givenUp) throw new DemoStepError(failReason ?? `화면에서 ${target.text ?? '다음 대상'}을(를) 찾지 못했어요.`)
        await sleep(120, tools.signal)
      }
    })
    .with({ kind: 'back' }, async ({ count }) => {
      for (let i = 0; i < count; i += 1) {
        history.back()
        await sleep(450, tools.signal)
      }
    })
    .with({ kind: 'click' }, async ({ target, optional = false }) => {
      const element = optional ? queryVisible(target) : await findTarget(target, tools.signal)
      if (element === undefined) return
      await moveTo(element, tools)
      await press(tools)
      element.click()
      await sleep(400, tools.signal)
    })
    .with({ kind: 'type' }, async ({ target, text }) => {
      const element = await findTarget(target, tools.signal)
      if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement)) {
        throw new DemoStepError('글자를 넣을 칸을 찾지 못했어요.')
      }
      await moveTo(element, tools)
      await press(tools)
      element.focus()
      setValue(element, '')
      for (const char of text) {
        setValue(element, element.value + char)
        await sleep(TYPE_INTERVAL_MS, tools.signal)
      }
    })
    .with({ kind: 'spotlight' }, async ({ target }) => {
      const element = await findTarget(target, tools.signal)
      await scrollIntoView(element, tools.signal)
      tools.setSpotlight(element)
      await sleep(500, tools.signal)
    })
    .with({ kind: 'pause' }, ({ ms }) => sleep(ms, tools.signal))
    .exhaustive()
}

/** 선택자에 맞고 글자를 담은, 화면에 보이는 첫 요소를 나타날 때까지 기다린다 */
async function findTarget(target: DemoTarget, signal: AbortSignal, timeoutMs = DEMO_TARGET_TIMEOUT_MS): Promise<HTMLElement> {
  const until = Date.now() + timeoutMs
  for (;;) {
    const found = queryVisible(target)
    if (found) return found
    if (Date.now() > until) throw new DemoStepError(`화면에서 ${target.text ?? '다음 대상'}을(를) 찾지 못했어요.`)
    await sleep(120, signal)
  }
}

/** 선택자에 맞고 글자 조건을 채운, 화면에 그려진 첫 요소 */
function queryVisible({ selector, text, exact = false }: DemoTarget): HTMLElement | undefined {
  return Array.from(document.querySelectorAll<HTMLElement>(selector)).find((element) => {
    if (element.getClientRects().length === 0) return false
    if (text === undefined) return true
    const content = (element.textContent ?? '').trim()
    return exact ? content === text : content.includes(text)
  })
}

async function moveTo(element: HTMLElement, tools: DemoTools) {
  await scrollIntoView(element, tools.signal)
  const rect = element.getBoundingClientRect()
  tools.setCursor((cursor) => ({ x: rect.left + Math.min(rect.width / 2, 48), y: rect.top + rect.height / 2, pressing: cursor?.pressing ?? false }))
  await sleep(CURSOR_MOVE_MS, tools.signal)
}

async function press(tools: DemoTools) {
  tools.setCursor((cursor) => (cursor === null ? null : { ...cursor, pressing: true }))
  await sleep(140, tools.signal)
  tools.setCursor((cursor) => (cursor === null ? null : { ...cursor, pressing: false }))
}

/** 화면 밖이면 가운데로 부드럽게 옮기고 멈출 때까지 기다린다 */
async function scrollIntoView(element: HTMLElement, signal: AbortSignal) {
  const rect = element.getBoundingClientRect()
  const visible = rect.top >= 80 && rect.bottom <= window.innerHeight - 120
  if (visible) return
  element.scrollIntoView({ behavior: 'smooth', block: 'center' })
  await sleep(600, signal)
}

/** React가 값 바뀜을 알아채도록 기본 setter로 값을 넣고 input 이벤트를 보낸다 */
function setValue(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), 'value')?.set
  setter?.call(element, value)
  element.dispatchEvent(new Event('input', { bubbles: true }))
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms)
    signal.addEventListener('abort', () => clearTimeout(timer), { once: true })
  })
}
