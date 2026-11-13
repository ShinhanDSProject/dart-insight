import { match, P } from 'ts-pattern'

/**
 * 시연 진행 상태(#967). 발표자가 Space로 넘길 때마다 다음 단계를 한 번 실행한다.
 * idle: 아직 시작 전(next: Space를 누르면 실행할 단계). running: 단계를 실행하는 중(커서 이동·입력·클릭). done: 단계를 마치고 다음 Space를 기다림.
 * failed: 단계를 끝내지 못함(찾을 화면이 없거나 늦음). Space로 다음 단계로 넘어간다. finished: 마지막 단계까지 마침.
 * leaving: 마친 뒤 Space를 눌러 발표 페이지의 Q&A 장으로 돌아가는 중(#970).
 * manual: 발표 페이지 안에서 Esc로 직접 조작으로 바꿈. 키를 가로채지 않고 '발표로 돌아가기' 버튼만 남긴다(#972).
 */
export type DemoState =
  | { status: 'idle'; next: number }
  | { status: 'running'; step: number }
  | { status: 'done'; step: number }
  | { status: 'failed'; step: number; reason: string }
  | { status: 'finished' }
  | { status: 'leaving' }
  | { status: 'manual' }

export type DemoEvent =
  | { type: 'next' }
  | { type: 'step-done' }
  | { type: 'step-failed'; reason: string }
  | { type: 'take-over' }
  | { type: 'leave' }

/** start: 처음 실행할 단계(0부터). 리허설이나 중간에 멈췄을 때 ?demo=5처럼 이어서 시작한다 */
export function initialDemoState(start = 0): DemoState {
  return { status: 'idle', next: start }
}

/** 단계 수(total)를 받아 reducer를 만든다. 실행 중에 누른 Space는 무시해 단계가 겹치지 않게 한다 */
export function createDemoReducer(total: number) {
  const advance = (from: number): DemoState => (from + 1 < total ? { status: 'running', step: from + 1 } : { status: 'finished' })
  return (state: DemoState, event: DemoEvent): DemoState =>
    match([state, event])
      .with([{ status: 'idle' }, { type: 'next' }], ([s]): DemoState => (s.next < total ? { status: 'running', step: s.next } : { status: 'finished' }))
      .with([{ status: 'running' }, { type: 'step-done' }], ([s]) => ({ status: 'done' as const, step: s.step }))
      .with([{ status: 'running' }, { type: 'step-failed' }], ([s, e]) => ({ status: 'failed' as const, step: s.step, reason: e.reason }))
      .with([{ status: 'done' }, { type: 'next' }], [{ status: 'failed' }, { type: 'next' }], ([s]) => advance(s.step))
      .with([{ status: 'finished' }, { type: 'next' }], [{ status: 'manual' }, { type: 'leave' }], (): DemoState => ({ status: 'leaving' }))
      .with([{ status: P.not('leaving') }, { type: 'take-over' }], (): DemoState => ({ status: 'manual' }))
      .otherwise(() => state)
}

/** 화면 아래 단계 표시(예: '3 / 8'). 시작 전과 끝난 뒤는 없음 */
export function demoProgress(state: DemoState, total: number): string | null {
  return match(state)
    .with({ status: 'idle' }, { status: 'finished' }, { status: 'leaving' }, { status: 'manual' }, () => null)
    .with({ status: 'running' }, { status: 'done' }, { status: 'failed' }, (s) => `${s.step + 1} / ${total}`)
    .exhaustive()
}
