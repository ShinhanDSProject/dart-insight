import type { SummaryTarget } from '@/shared/api/summary'
import { Badge, Button, Card, PanelTitle } from '@/shared/ui'
import { HEADLINE_NOTE, type HeadlineLine } from '../model/summaryHeadline'

interface SummaryHeadlineProps {
  lines: HeadlineLine[]
  /** 요약 카드의 근거 버튼과 같은 곳을 연다. 열 수 없으면 null(줄을 글자로만 보임) */
  opener: (target: SummaryTarget) => (() => void) | null
}

/**
 * 요약 탭 맨 위 '핵심 3줄'(FS-21). 재무 줄은 코드가 계산한 사실 문장, 문장 줄은 'AI 생성' 요약이다.
 * 줄을 누르면 재무 줄은 수치 근거, 문장 줄은 문장 변화 탭의 그 변경으로 간다. 고를 줄이 없으면 그리지 않는다.
 */
export function SummaryHeadline({ lines, opener }: SummaryHeadlineProps) {
  if (lines.length === 0) return null
  return (
    <Card as="section" className="headline" aria-labelledby="summary-headline-title">
      <PanelTitle id="summary-headline-title">이번 비교의 핵심</PanelTitle>
      <ol className="headline__list">
        {lines.map((line, index) => {
          const open = opener(line.target)
          const body = (
            <>
              <span className="headline__no" aria-hidden="true">
                {index + 1}
              </span>
              <span className="headline__text">
                {line.aiGenerated && <Badge tone="accent">AI 생성</Badge>} {line.text}
              </span>
              {open && (
                <span className="headline__hint">{line.kind === 'FINANCIAL' ? '수치 근거' : '변경 근거'} ›</span>
              )}
            </>
          )
          return (
            <li key={`${line.kind}-${line.itemNo}`}>
              {open ? (
                <Button variant="link" className="headline__line" onClick={open}>
                  {body}
                </Button>
              ) : (
                <p className="headline__line">{body}</p>
              )}
            </li>
          )
        })}
      </ol>
      <p className="panel__note">{HEADLINE_NOTE}</p>
    </Card>
  )
}
