import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { match } from 'ts-pattern'
import { RESULT_TOUR_CHANGE_EVENT, RESULT_TOUR_SEEN_KEY } from '@/shared/lib/resultTour'
import { Button, Icon, Mascot } from '@/shared/ui'
import {
  GUIDE_OFF_PATH_STEP,
  GUIDE_STAGES,
  GUIDE_STEPS,
  RESULT_TASKS,
  guideStage,
  stageState,
  withDoneTasks,
  type BoothGuideView,
  type GuideShortcut,
  type GuideTarget,
  type ResultTask,
  type ResultTaskId,
} from '../model/boothGuide'
import '../booth-guide.css'

/** 강조를 보이는 시간 */
const SPOTLIGHT_MS = 4_000
/** 탭을 바꾸거나 화면을 옮긴 뒤 강조할 곳이 그려질 때까지 기다리는 시간(기업 화면은 보고서 목록을 받아야 그려진다) */
const TARGET_WAIT_MS = 8_000

/** 선택자에 맞는, 문서에 붙어 있고 화면에 보이는 첫 요소 */
function findVisible(selector: string): HTMLElement | null {
  return [...document.querySelectorAll<HTMLElement>(selector)].find((el) => el.isConnected && el.getClientRects().length > 0) ?? null
}

/**
 * 강조할 요소. 기다리는 동안에는 첫 선택자만 찾고, 기다릴 시간이 다 되면 뒤의 대신할 곳까지 찾는다
 * (탭을 막 바꿔 표가 아직 없을 때 탭 전체를 먼저 잡지 않게)
 */
function findTarget(target: GuideTarget, fallback: boolean): HTMLElement | null {
  for (const selector of fallback ? target : target.slice(0, 1)) {
    const found = findVisible(selector)
    if (found) return found
  }
  return null
}

/** 누를 곳 둘레에 테두리를 그린다. 화면을 가리지 않고(누르기를 막지 않음), 스크롤해도 따라간다 */
function useSpotlight() {
  const [element, setElement] = useState<HTMLElement | null>(null)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const request = useRef(0)

  useEffect(() => {
    if (element === null) return
    let frame = requestAnimationFrame(function follow() {
      // 탭을 바꾸는 등으로 대상이 사라지면 빈 자리에 테두리가 남지 않게 끈다
      if (!element.isConnected) {
        setElement(null)
        return
      }
      setRect(element.getBoundingClientRect())
      frame = requestAnimationFrame(follow)
    })
    const timer = setTimeout(() => setElement(null), SPOTLIGHT_MS)
    const clear = () => setElement(null)
    window.addEventListener('pointerdown', clear, true)
    return () => {
      cancelAnimationFrame(frame)
      clearTimeout(timer)
      window.removeEventListener('pointerdown', clear, true)
      setRect(null)
    }
  }, [element])

  /**
   * 강조할 곳이 아직 없으면 잠깐 기다렸다가 찾는다. 새 화면·탭이 그려지는 중이면(settling) 첫 대상이 그려질 때까지
   * 대신할 곳(탭 전체 등)을 잡지 않는다. focus가 있으면 그 요소로 키보드 초점도 옮긴다
   */
  const show = useCallback((target: GuideTarget, settling = false, focus: string | null = null) => {
    const id = ++request.current
    const started = performance.now()
    const tryFind = () => {
      if (id !== request.current) return
      const waited = performance.now() - started >= TARGET_WAIT_MS
      const found = findTarget(target, !settling || waited)
      if (found) {
        const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
        found.scrollIntoView({ block: 'center', behavior: reduceMotion ? 'auto' : 'smooth' })
        if (focus !== null) findVisible(focus)?.focus({ preventScroll: true })
        setElement(found)
      } else if (!waited) {
        setTimeout(tryFind, 150)
      }
    }
    // 버튼을 누른 pointerdown이 강조를 지운 뒤, 탭을 바꿨으면 새 탭이 그려진 뒤에 찾는다
    setTimeout(tryFind, 150)
  }, [])

  return { rect, show }
}

/** AI 에이전트 패널이 열려 있는지. 결과 화면에서만 살핀다 */
function useChatOpen(enabled: boolean): boolean {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (!enabled) return
    const check = () => setOpen(document.getElementById('chat-panel') !== null)
    check()
    const timer = setInterval(check, 800)
    // 결과 화면을 떠났다 돌아왔을 때 지난번 값으로 해 본 일이 표시되지 않게 지운다
    return () => {
      clearInterval(timer)
      setOpen(false)
    }
  }, [enabled])
  return enabled && open
}

interface BoothGuideProps {
  view: Exclude<BoothGuideView, 'off'>
  onViewChange: (view: BoothGuideView) => void
}

/**
 * 전시 부스 '따라 해 보기' 카드. 왼쪽 아래에 떠서 지금 화면에서 할 일을 알려 주고, 화면을 옮기면 그 단계로 따라간다.
 * 결과 화면에서는 해 볼 일 목록을 두고 해 본 일에 표시한다. 대기 화면으로 돌아가 다음 방문자가 오면 처음부터 다시 보인다.
 */
export function BoothGuide({ view, onViewChange }: BoothGuideProps) {
  const { pathname, search } = useLocation()
  const navigate = useNavigate()
  const stage = guideStage(pathname)
  const step = stage === null ? GUIDE_OFF_PATH_STEP : GUIDE_STEPS[stage]
  const stageIndex = GUIDE_STAGES.findIndex((item) => item.stage === stage)
  const spotlight = useSpotlight()
  const chatOpen = useChatOpen(stage === 'result')
  const [done, setDone] = useState<ReadonlySet<ResultTaskId>>(() => new Set())
  // 결과 화면에서 고른 해 볼 일. 카드 설명이 이 일을 따른다
  const [activeTaskId, setActiveTaskId] = useState<ResultTaskId | null>(null)
  const activeTask = stage === 'result' ? (RESULT_TASKS.find((task) => task.id === activeTaskId) ?? null) : null
  const titleRef = useRef<HTMLHeadingElement>(null)
  const fabRef = useRef<HTMLButtonElement>(null)

  // 결과 화면 첫 방문 둘러보기가 이 카드와 겹쳐 뜨지 않게 본 것으로 둔다(시연 모드와 같은 방식)
  useEffect(() => {
    try {
      localStorage.setItem(RESULT_TOUR_SEEN_KEY, '1')
    } catch {
      // 저장소를 쓸 수 없으면 둘러보기가 함께 보일 수 있다
    }
    window.dispatchEvent(new Event(RESULT_TOUR_CHANGE_EVENT))
  }, [])

  // 새 단계(화면)에 들어오면 다음에 누를 곳에 바로 테두리를 그리고 초점을 옮긴다. 접어 둔 동안에는 하지 않는다
  const open = view === 'open'
  const showSpotlight = spotlight.show
  useEffect(() => {
    if (!open || step.target === null) return
    showSpotlight(step.target, true, step.focus)
  }, [open, pathname, step, showSpotlight])

  useEffect(() => {
    if (stage !== 'result') return
    const params = new URLSearchParams(search)
    setDone((prev) => withDoneTasks(prev, { tab: params.get('tab'), chatOpen }))
  }, [stage, search, chatOpen])

  const openTask = (task: ResultTask) => {
    setActiveTaskId(task.id)
    const params = new URLSearchParams(search)
    const switching = task.tab !== null && params.get('tab') !== task.tab
    if (switching && task.tab !== null) {
      params.set('tab', task.tab)
      // 결과 화면의 탭 줄처럼 기록을 쌓지 않는다(뒤로 가기가 탭을 거슬러 오르지 않게)
      navigate({ pathname, search: params.toString() }, { replace: true })
    }
    spotlight.show(task.target, switching)
  }

  const runShortcut = (shortcut: GuideShortcut) => {
    match(shortcut)
      .with({ kind: 'go' }, ({ to }) => navigate(to))
      .with({ kind: 'spotlight' }, ({ target: shortcutTarget }) => spotlight.show(shortcutTarget))
      // 링크를 누르게 해서 화면의 라우팅을 그대로 탄다. 이미 분석한 비교가 없으면 아무 일도 하지 않는다
      .with({ kind: 'open' }, ({ link }) => document.querySelector<HTMLElement>(link)?.click())
      .exhaustive()
  }

  const restart = () => {
    setDone(new Set())
    setActiveTaskId(null)
    navigate('/')
    window.scrollTo({ top: 0 })
  }

  // 접기 버튼이 카드와 함께 사라지므로 초점을 접힌 버튼으로 옮긴다
  const fold = () => {
    onViewChange('folded')
    requestAnimationFrame(() => fabRef.current?.focus())
  }

  const unfold = () => {
    onViewChange('open')
    requestAnimationFrame(() => titleRef.current?.focus())
  }

  const ring: CSSProperties | undefined = spotlight.rect
    ? ({
        '--spot-x': `${spotlight.rect.left}px`,
        '--spot-y': `${spotlight.rect.top}px`,
        '--spot-w': `${spotlight.rect.width}px`,
        '--spot-h': `${spotlight.rect.height}px`,
      } as CSSProperties)
    : undefined

  return (
    <>
      {ring && <div className="booth-spotlight" style={ring} aria-hidden="true" />}
      {view === 'folded' ? (
        <Button variant="primary" className="booth-guide-fab" onClick={unfold} ref={fabRef}>
          <Mascot mood="joy" size="sm" className="booth-guide__mascot" />
          따라 해 보기
        </Button>
      ) : (
        <aside className="booth-guide" aria-labelledby="booth-guide-title">
          <div className="booth-guide__head">
            <Mascot mood="joy" size="sm" className="booth-guide__mascot" />
            <p className="booth-guide__eyebrow">
              따라 해 보기
              {stageIndex >= 0 && (
                <span className="booth-guide__count">
                  {stageIndex + 1} / {GUIDE_STAGES.length} {GUIDE_STAGES[stageIndex].label}
                </span>
              )}
            </p>
            <Button variant="icon" className="booth-guide__fold" aria-label="안내 접기" onClick={fold}>
              <Icon name="x" size={16} />
            </Button>
          </div>
          {/* 단계는 막대로만 보이고 이름은 화면 읽기 프로그램에 읽힌다(좁은 카드에서 이름이 겹치지 않게) */}
          <ol className="booth-guide__stages" aria-label="진행 단계">
            {GUIDE_STAGES.map((item, index) => (
              <li
                key={item.stage}
                className="booth-guide__stage"
                data-state={stageState(index, stageIndex)}
                aria-current={index === stageIndex ? 'step' : undefined}
              >
                <span className="visually-hidden">{item.label}</span>
              </li>
            ))}
          </ol>
          <h2 id="booth-guide-title" className="booth-guide__title" tabIndex={-1} ref={titleRef} aria-live="polite">
            {step.title}
          </h2>
          <p className="booth-guide__text">{activeTask?.text ?? step.text}</p>
          {stage === 'result' && (
            <ul className="booth-guide__tasks" aria-label="해 볼 일">
              {RESULT_TASKS.map((task) => (
                <li key={task.id}>
                  <button
                    type="button"
                    className="booth-guide__task"
                    data-done={done.has(task.id) || undefined}
                    aria-pressed={activeTask?.id === task.id}
                    onClick={() => openTask(task)}
                  >
                    <span className="booth-guide__check" aria-hidden="true">
                      {done.has(task.id) ? '✓' : ''}
                    </span>
                    {task.label}
                    {done.has(task.id) && <span className="visually-hidden"> (해 봤어요)</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="booth-guide__actions">
            <Button variant="link" onClick={restart}>
              처음부터
            </Button>
            <span className="booth-guide__nav">
              {step.shortcut && (
                <Button variant="secondary" onClick={() => step.shortcut && runShortcut(step.shortcut)}>
                  {step.shortcut.label}
                </Button>
              )}
            </span>
          </div>
        </aside>
      )}
    </>
  )
}
