import type { CSSProperties, ReactNode } from 'react'
import type { FinancialChangeItem } from '@/shared/api/results'
import type { SummaryTarget } from '@/shared/api/summary'
import { Badge, Button, Card, Mascot, PanelTitle } from '@/shared/ui'
import { amountBars } from '../model/summaryAmounts'
import { glossaryForAccount, headlineTitle, type HeadlineLine } from '../model/summaryHeadline'
import { deletedNote } from '../model/summaryLabels'

interface SummaryHeadlineProps {
  lines: HeadlineLine[]
  /** 요약 카드의 근거 버튼과 같은 곳을 연다. 열 수 없으면 null(줄을 글자로만 보임) */
  opener: (target: SummaryTarget) => (() => void) | null
  /** 재무 줄의 이전·현재 금액(changeId로 찾음). 못 불러오면 null이고 줄은 문장만 보인다 */
  amounts: Map<number, FinancialChangeItem> | null
  /** 2단계 '왜 바뀌었는지 보기': 문장 변화 탭을 먼저 볼 것 순으로 연다 */
  onOpenWhy: () => void
  /** 3단계 'AI에게 묻기': 요약 탭의 질문 칸으로 옮긴다 */
  onOpenAsk: () => void
  /** 카드 아래 한 줄(바뀐 계정·문장·검토 필요 수, #560) */
  footer?: ReactNode
}

/**
 * 요약 탭 맨 위 '핵심 3줄'(FS-21, #821). 처음 온 사람이 순서를 따라가도록 '핵심 보기 → 왜 바뀌었는지 → AI에게 묻기' 3단계를 두고,
 * 재무 줄은 계정 이름·▲▼ 증감률·이전·현재 막대로 크기를 먼저 보인다(문장은 화면 읽기용으로 남김). 문장 줄은 'AI 생성' 요약이다.
 * 줄을 누르면 재무 줄은 수치 근거, 문장 줄은 문장 변화 탭의 그 변경으로 간다. 고를 줄이 없으면 그리지 않는다.
 * 삭제 줄에는 '빠졌다고 끝났다는 뜻은 아니에요' 안내를 붙인다(FS-70). 제목 옆 캐릭터는 처음 열 때 두 번 뛰고 멈춘다(#706).
 */
export function SummaryHeadline({ lines, opener, amounts, onOpenWhy, onOpenAsk, footer }: SummaryHeadlineProps) {
  if (lines.length === 0) return footer ?? null
  return (
    <Card as="section" className="headline" aria-labelledby="summary-headline-title">
      <div className="headline__head">
        <Mascot mood="found" />
        <PanelTitle id="summary-headline-title">{headlineTitle(lines.length)}</PanelTitle>
      </div>
      <ol className="headline-steps" aria-label="보는 순서">
        <li>
          <span className="headline-steps__step headline-steps__step--current" aria-current="step">
            <span className="headline-steps__no" aria-hidden="true">
              1
            </span>
            핵심 숫자 보기
          </span>
        </li>
        <li>
          <Button variant="link" className="headline-steps__step" onClick={onOpenWhy}>
            <span className="headline-steps__no" aria-hidden="true">
              2
            </span>
            왜 바뀌었는지 보기
          </Button>
        </li>
        <li>
          <Button variant="link" className="headline-steps__step" onClick={onOpenAsk}>
            <span className="headline-steps__no" aria-hidden="true">
              3
            </span>
            궁금한 것 AI에게 묻기
          </Button>
        </li>
      </ol>
      <ol className="headline__list">
        {lines.map((line, index) => {
          const open = opener(line.target)
          const amount = line.kind === 'FINANCIAL' && line.target.changeId !== null ? amounts?.get(line.target.changeId) : undefined
          const body = (
            <>
              <span className="headline__no" aria-hidden="true">
                {index + 1}
              </span>
              {amount ? <FigureLine text={line.text} amount={amount} /> : <TextLine line={line} />}
              {open && <span className="headline__hint">{line.kind === 'FINANCIAL' ? '수치 근거' : '변경 근거'} ›</span>}
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
      {footer}
    </Card>
  )
}

function TextLine({ line }: { line: HeadlineLine }) {
  const deleted = deletedNote(line.target)
  return (
    <span className="headline__text">
      {line.aiGenerated && <Badge tone="accent">AI 생성</Badge>} {line.text}
      {deleted && <span className="deleted-note">{deleted}</span>}
    </span>
  )
}

/** 재무 줄: 계정 이름과 증감률을 크게, 아래에 용어 풀이(카드가 있을 때만), 오른쪽에 이전·현재 막대. 사실 문장은 화면 읽기용 */
function FigureLine({ text, amount }: { text: string; amount: FinancialChangeItem }) {
  const bars = amountBars(amount)
  const term = glossaryForAccount(amount.accountName)
  return (
    <>
      <span className="headline__figure">
        <span className="headline__account" aria-hidden="true">
          {amount.accountName}
          {bars.rate !== null && <Badge>{bars.rate}</Badge>}
        </span>
        <span className="visually-hidden">{text}</span>
        {term && <span className="headline__term">용어 풀이 · {term.definition}</span>}
      </span>
      <span className="headline__bars" aria-hidden="true">
        <Bar label="이전" value={bars.previous.label} ratio={bars.previous.ratio} />
        <Bar label="현재" value={bars.current.label} ratio={bars.current.ratio} current />
      </span>
    </>
  )
}

function Bar({ label, value, ratio, current = false }: { label: string; value: string; ratio: number; current?: boolean }) {
  return (
    <span className={current ? 'headline-bar headline-bar--current' : 'headline-bar'}>
      <span className="headline-bar__label">
        <span>{label}</span>
        <span>{value}</span>
      </span>
      <span className="headline-bar__track">
        <span className="headline-bar__fill" style={{ '--bar-ratio': ratio } as CSSProperties} />
      </span>
    </span>
  )
}
