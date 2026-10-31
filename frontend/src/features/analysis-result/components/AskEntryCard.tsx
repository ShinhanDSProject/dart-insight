import { useState, type FormEvent } from 'react'
import type { LoadState } from '@/shared/hooks/asyncState'
import { Button, Card, Input } from '@/shared/ui'
import { AskSuggestions } from './AskSuggestions'

/** AI 질문 탭 입력칸과 같은 최대 길이 */
const MAX_QUESTION_LENGTH = 200

interface AskEntryCardProps {
  suggestions: LoadState<string[]>
  /** AI 질문 탭으로 가서 바로 묻는다 */
  onAsk: (question: string) => void
  /** AI 질문 탭을 연다 */
  onOpenAsk: () => void
  /** 다른 질문을 보내는 중 */
  sending: boolean
}

/**
 * 요약 탭의 '궁금한 걸 물어보세요'(W-03 ①, 3.10, #560). 입력칸에 바로 묻거나 AI 질문 탭과 같은 예시 질문 2개를 누른다.
 * 묻는 중이면 AI 질문 탭으로 가는 링크를 보인다.
 */
export function AskEntryCard({ suggestions, onAsk, onOpenAsk, sending }: AskEntryCardProps) {
  const [question, setQuestion] = useState('')

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const trimmed = question.trim()
    if (trimmed === '' || sending) return
    onAsk(trimmed)
    setQuestion('')
  }

  return (
    <Card as="section" className="ask-entry" aria-labelledby="ask-entry-title">
      <h2 id="ask-entry-title" className="ask-entry__title">
        궁금한 걸 물어보세요
      </h2>
      <form className="ask-entry__form" onSubmit={handleSubmit}>
        <label htmlFor="ask-entry-input" className="visually-hidden">
          AI에게 물어볼 질문
        </label>
        <Input
          id="ask-entry-input"
          className="ask-entry__input"
          value={question}
          maxLength={MAX_QUESTION_LENGTH}
          placeholder="예: 매출액은 왜 늘었나요?"
          onChange={(e) => setQuestion(e.target.value)}
        />
        <Button type="submit" variant="primary" disabled={sending}>
          묻기
        </Button>
      </form>
      <AskSuggestions suggestions={suggestions} onAsk={onAsk} disabled={sending} limit={2} />
      <p className="ask-entry__lead">두 보고서 원문과 계산한 수치로만 답하고, 답마다 원문 위치를 보여 드려요.</p>
      {sending && (
        <Button variant="link" className="ask-entry__more" onClick={onOpenAsk}>
          답을 찾는 중이에요 · AI 질문에서 보기
        </Button>
      )}
    </Card>
  )
}
