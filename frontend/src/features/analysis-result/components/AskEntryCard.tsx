import type { LoadState } from '@/shared/hooks/asyncState'
import { Button, Card } from '@/shared/ui'
import { AskSuggestions } from './AskSuggestions'

interface AskEntryCardProps {
  suggestions: LoadState<string[]>
  /** AI 질문 탭으로 가서 바로 묻는다 */
  onAsk: (question: string) => void
  /** AI 질문 탭을 연다(직접 묻기) */
  onOpenAsk: () => void
  /** 다른 질문을 보내는 중 */
  sending: boolean
}

/** 요약 탭의 AI 질문 진입 카드(W-03 ①, 3.10). AI 질문 탭과 같은 예시 질문 3개를 보인다 */
export function AskEntryCard({ suggestions, onAsk, onOpenAsk, sending }: AskEntryCardProps) {
  return (
    <Card as="section" className="ask-entry" aria-labelledby="ask-entry-title">
      <div className="ask-entry__head">
        <h2 id="ask-entry-title" className="ask-entry__title">
          AI에게 물어보기
        </h2>
        <p className="ask-entry__lead">두 보고서 원문과 계산한 수치로 답하고, 답마다 원문 위치를 함께 보여 줘요.</p>
      </div>
      <AskSuggestions suggestions={suggestions} onAsk={onAsk} disabled={sending} limit={3} />
      <Button variant="link" className="ask-entry__more" onClick={onOpenAsk}>
        {sending ? '답을 찾는 중이에요 · AI 질문에서 보기' : '직접 물어보기'}
      </Button>
    </Card>
  )
}
