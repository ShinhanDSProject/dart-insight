import type { CSSProperties } from 'react'
import { Panel, PanelTitle } from '@/shared/ui'

/** 기다리는 동안 읽을 짧은 안내. 화면 규칙(design-system.md)에 있는 뜻만 적는다 */
export const WAIT_TIPS = [
  { term: '연결재무제표', text: '는 자회사까지 합친 숫자예요. 별도재무제표와 크게 다르면 자회사 쪽 변화가 큰 거예요.' },
  { term: "'검토 필요'", text: '는 근거를 확인하지 못한 변화예요. 원문 확인으로 직접 살펴보세요.' },
  { term: '▲▼ 증감', text: '은 바뀐 크기만 보여 줘요. 좋고 나쁨을 뜻하지 않아요.' },
] as const

/**
 * 분석 진행 중 아래 '기다리는 동안 알아 두면 좋아요'(동적 화면 시안 ②). 안내가 하나씩 차례로 바뀐다.
 * 화면 읽기 도구와 동작 줄이기에서는 세 줄을 모두 목록으로 보인다.
 */
export function WaitTips() {
  return (
    <Panel className="wait-tips" aria-labelledby="wait-tips-title">
      <PanelTitle as="h3" id="wait-tips-title">
        기다리는 동안 알아 두면 좋아요
      </PanelTitle>
      <ul className="wait-tips__list">
        {WAIT_TIPS.map((tip, index) => (
          <li key={tip.term} style={{ '--i': index } as CSSProperties}>
            <strong>{tip.term}</strong>
            {tip.text}
          </li>
        ))}
      </ul>
    </Panel>
  )
}
