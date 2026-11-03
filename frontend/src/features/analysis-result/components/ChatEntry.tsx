import { useState, type FormEvent } from 'react'
import { Button, Card, FieldLabel, Input } from '@/shared/ui'
import { CHAT_EXAMPLES, chatMessageOf, MAX_MESSAGE } from '../model/chatState'

interface ChatEntryProps {
  /** 이 분석에서 답할 수 있는 예시 질문 */
  suggestions: string[]
  /** 요청을 채팅 패널로 보내고 패널을 연다 */
  onAsk: (message: string) => void
  disabled: boolean
}

/**
 * 요약 탭의 AI 에이전트 입구(예전 AI 질문 자리, #575). 여기서 쓴 요청은 오른쪽 채팅 패널로 보낸다.
 * 입력창 id(ask-input)는 단축키가 초점을 옮기는 자리라 바꾸지 않는다.
 */
export function ChatEntry({ suggestions, onAsk, disabled }: ChatEntryProps) {
  const [draft, setDraft] = useState('')
  const message = chatMessageOf(draft)
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (message === null || disabled) return
    onAsk(message)
    setDraft('')
  }
  return (
    <Card as="section" className="chat-entry" aria-labelledby="chat-entry-title">
      <h2 id="chat-entry-title" className="chat-entry__title">
        AI 에이전트에게 요청하기
      </h2>
      <form className="chat-entry__form" onSubmit={submit}>
        <FieldLabel htmlFor="ask-input" className="visually-hidden">
          AI 에이전트에게 요청
        </FieldLabel>
        <Input
          id="ask-input"
          value={draft}
          maxLength={MAX_MESSAGE}
          placeholder="예: 소송 관련 변경만 보여줘"
          onChange={(e) => setDraft(e.target.value)}
        />
        <Button variant="primary" type="submit" disabled={message === null || disabled}>
          보내기
        </Button>
      </form>
      <div className="chat-panel__chips">
        {[...suggestions, ...CHAT_EXAMPLES].slice(0, 5).map((q) => (
          <Button key={q} variant="secondary" disabled={disabled} onClick={() => onAsk(q)}>
            {q}
          </Button>
        ))}
      </div>
    </Card>
  )
}
