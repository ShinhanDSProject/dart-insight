import { useEffect, useReducer, useState, type CSSProperties } from 'react'
import { match } from 'ts-pattern'
import { RESULT_TOUR_CHANGE_EVENT, RESULT_TOUR_SEEN_KEY } from '@/shared/lib/resultTour'
import { writeDemoStorage } from '../hooks/useDemoMode'
import { useDemoStepRunner, type DemoCursor } from '../hooks/useDemoStepRunner'
import { DEMO_NEXT_STEP_KEY } from '../model/demoActivation'
import { createDemoReducer, demoProgress, initialDemoState } from '../model/demoState'
import { DEMO_SCENARIO } from '../model/scenario'
import '../demo-autopilot.css'

const reducer = createDemoReducer(DEMO_SCENARIO.length)
/** 다음 단계로 넘기는 키. 발표 리모컨은 PageDown·→를 보낸다 */
const NEXT_KEYS = new Set([' ', 'ArrowRight', 'PageDown', 'Enter'])

/**
 * 시연 자동 진행(#967). 발표자가 Space(→)를 누를 때마다 시나리오의 한 단계를 실제 화면에 실행하고,
 * 가짜 커서·강조 상자·아래 자막으로 무엇을 하는지 보인다. Esc를 누르면 꺼지고 그 자리에서 직접 조작한다.
 * 시연 중에는 넘김 키를 먼저 받아(capture) 입력창에 공백이 들어가거나 다른 단축키가 돌지 않게 한다.
 */
export function DemoAutopilot({ startStep, onExit }: { startStep: number; onExit: () => void }) {
  const [state, dispatch] = useReducer(reducer, startStep, initialDemoState)
  const { cursor, spotlight } = useDemoStepRunner({
    state,
    steps: DEMO_SCENARIO,
    onDone: () => dispatch({ type: 'step-done' }),
    onFailed: (reason) => dispatch({ type: 'step-failed', reason }),
  })

  // 화면이 통째로 새로 불려도(개발 서버의 새로 고침 등) 다음 단계부터 이어 가도록 남긴다
  useEffect(() => {
    const next = match(state)
      .with({ status: 'idle' }, ({ next }) => next)
      .with({ status: 'running' }, ({ step }) => step)
      .with({ status: 'done' }, { status: 'failed' }, ({ step }) => step + 1)
      .with({ status: 'finished' }, () => null)
      .exhaustive()
    writeDemoStorage(DEMO_NEXT_STEP_KEY, next === null ? null : String(next))
  }, [state])

  // 결과 화면 첫 방문 둘러보기가 시연 중에 끼어들지 않게 본 것으로 둔다
  useEffect(() => {
    try {
      localStorage.setItem(RESULT_TOUR_SEEN_KEY, '1')
    } catch {
      // 저장소를 쓸 수 없으면 둘러보기가 보일 수 있다
    }
    window.dispatchEvent(new Event(RESULT_TOUR_CHANGE_EVENT))
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopImmediatePropagation()
        onExit()
        return
      }
      if (!NEXT_KEYS.has(event.key) || event.metaKey || event.ctrlKey || event.altKey) return
      event.preventDefault()
      event.stopImmediatePropagation()
      dispatch({ type: 'next' })
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onExit])

  const progress = demoProgress(state, DEMO_SCENARIO.length)
  const { title, caption } = match(state)
    .with({ status: 'idle' }, ({ next }) =>
      next === 0
        ? { title: '시연', caption: 'Space를 누르면 DART Insight 시연을 시작해요.' }
        : { title: '시연', caption: `Space를 누르면 ${next + 1}단계 '${DEMO_SCENARIO[next].title}'부터 이어서 해요.` },
    )
    .with({ status: 'running' }, { status: 'done' }, (s) => DEMO_SCENARIO[s.step])
    .with({ status: 'failed' }, (s) => ({ title: DEMO_SCENARIO[s.step].title, caption: `${s.reason} Space로 다음 단계로 넘어가요.` }))
    .with({ status: 'finished' }, () => ({ title: '시연 끝', caption: '감사합니다. 이제 질문을 받겠습니다.' }))
    .exhaustive()

  return (
    <div className="demo-autopilot" aria-live="polite">
      {spotlight && <Spotlight element={spotlight} />}
      {cursor && <FakeCursor cursor={cursor} />}
      <div className="demo-caption" role="status">
        {progress && <span className="demo-caption__step">{progress}</span>}
        <span className="demo-caption__title">{title}</span>
        <span className="demo-caption__text">{caption}</span>
        <span className="demo-caption__keys" aria-hidden="true">
          {state.status === 'running' ? '진행 중…' : 'Space 다음 · Esc 직접 조작'}
        </span>
      </div>
    </div>
  )
}

/** 지금 보여 주는 곳만 밝게 남기고 나머지를 옅게 어둡게 한다. 스크롤·크기 바뀜을 매 프레임 따라간다 */
function Spotlight({ element }: { element: HTMLElement }) {
  const [rect, setRect] = useState(() => element.getBoundingClientRect())
  useEffect(() => {
    let frame = requestAnimationFrame(function track() {
      setRect(element.getBoundingClientRect())
      frame = requestAnimationFrame(track)
    })
    return () => cancelAnimationFrame(frame)
  }, [element])
  const style = {
    '--spot-x': `${rect.left}px`,
    '--spot-y': `${rect.top}px`,
    '--spot-w': `${rect.width}px`,
    '--spot-h': `${rect.height}px`,
  } as CSSProperties
  return <div className="demo-spotlight" style={style} aria-hidden="true" />
}

function FakeCursor({ cursor }: { cursor: DemoCursor }) {
  const style = { '--cursor-x': `${cursor.x}px`, '--cursor-y': `${cursor.y}px` } as CSSProperties
  return (
    <div className={`demo-cursor${cursor.pressing ? ' demo-cursor--pressing' : ''}`} style={style} aria-hidden="true">
      <svg viewBox="0 0 24 24" width="28" height="28">
        <path d="M4 2 L4 20 L9 15.5 L12.5 22 L15.5 20.6 L12.2 14.2 L19 14 Z" />
      </svg>
    </div>
  )
}
