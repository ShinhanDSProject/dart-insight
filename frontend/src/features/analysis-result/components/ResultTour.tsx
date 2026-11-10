import { useState } from 'react'
import { RESULT_TOUR_STEPS, type ResultTourTab } from '@/shared/lib/resultTour'
import { Button, Mascot } from '@/shared/ui'

interface ResultTourProps {
  /** 단계에 맞는 탭을 연다 */
  onGoTab: (tab: ResultTourTab) => void
  /** 마지막 단계의 'AI 에이전트 열기' */
  onOpenChat: () => void
  /** 끝내거나 건너뛰면 다시 띄우지 않는다 */
  onFinish: () => void
}

/**
 * 결과 화면 첫 방문 둘러보기(#842). 탭 바로 아래에 작은 카드로 '요약 → 문장 변화 → AI 에이전트' 3단계를 보인다.
 * 모달이 아니라 화면을 가리지 않고, 다음을 누르면 그 단계의 탭으로 옮긴다. 건너뛰기·마치기는 이 브라우저에 기억한다.
 */
export function ResultTour({ onGoTab, onOpenChat, onFinish }: ResultTourProps) {
  const [index, setIndex] = useState(0)
  const step = RESULT_TOUR_STEPS[index]
  const last = index === RESULT_TOUR_STEPS.length - 1
  const go = (next: number) => {
    setIndex(next)
    const tab = RESULT_TOUR_STEPS[next].tab
    if (tab !== null) onGoTab(tab)
  }
  return (
    <section className="result-tour" aria-labelledby="result-tour-title" aria-live="polite">
      <div className="result-tour__head">
        <Mascot mood="joy" size="sm" className="result-tour__mascot" />
        <h2 id="result-tour-title" className="result-tour__title">
          <span className="result-tour__count">
            {index + 1} / {RESULT_TOUR_STEPS.length}
          </span>{' '}
          {step.title}
        </h2>
      </div>
      <p className="result-tour__text">{step.text}</p>
      <div className="result-tour__actions">
        <Button variant="link" className="result-tour__skip" onClick={onFinish}>
          {last ? '닫기' : '건너뛰기'}
        </Button>
        <span className="result-tour__nav">
          {index > 0 && (
            <Button variant="secondary" onClick={() => go(index - 1)}>
              이전
            </Button>
          )}
          {last ? (
            <Button
              variant="primary"
              onClick={() => {
                onOpenChat()
                onFinish()
              }}
            >
              AI 에이전트 열기
            </Button>
          ) : (
            <Button variant="primary" onClick={() => go(index + 1)}>
              다음
            </Button>
          )}
        </span>
      </div>
    </section>
  )
}
