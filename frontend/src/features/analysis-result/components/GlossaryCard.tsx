import { match } from 'ts-pattern'
import type { GlossarySource, GlossaryTerm } from '@/shared/api/glossaryTerms'
import { easierQuestion, relatedTerms, termQuestion } from '@/shared/glossary/model/glossaryCards'
import type { LoadState } from '@/shared/hooks/asyncState'
import { Badge, Button, ButtonAnchor, Card } from '@/shared/ui'

/** 카드 API를 받기 전이나 받지 못했을 때 근거 칩만으로 보여 줄 값(근거의 용어·한 줄 뜻·출처) */
export interface GlossaryBasics {
  term: string
  definition: string
  sources: GlossarySource[]
}

interface GlossaryCardProps {
  /** 카드 API에서 찾은 카드. 없으면 basics만 보인다 */
  card: GlossaryTerm | null
  basics: GlossaryBasics
  /** 카드 목록 불러오기 상태(관련 용어 이름·실패 안내에 씀) */
  cards: LoadState<GlossaryTerm[]>
  /** 이어서 묻기: 채팅에 요청을 보낸다 */
  onAsk: (message: string) => void
}

/** 출처는 http(s) 주소만 링크로 연다(응답 값을 그대로 링크로 쓰지 않게) */
const WEB_URL = /^https?:\/\//

/**
 * 채팅의 용어 카드(ADR-0061). 뜻·예시·확인할 곳·판단하지 않음·출처를 보이고, 같은 용어로 더 쉽게 다시 묻거나
 * 관련 용어를 물을 수 있다(AC2·AC8). 뜻은 사람이 검토한 카드 그대로이고 AI가 만든 글이 아니다.
 */
export function GlossaryCard({ card, basics, cards, onAsk }: GlossaryCardProps) {
  const term = card?.term ?? basics.term
  const related = card !== null && cards.status === 'success' ? relatedTerms(cards.data, card) : []
  const sources = card?.sources ?? basics.sources
  return (
    <Card as="section" className="glossary-card" aria-label={`용어 카드: ${term}`}>
      <p className="glossary-card__head">
        <strong>{term}</strong> {card !== null && <Badge>{card.level === 'BASIC' ? '기초 카드' : '핵심 카드'}</Badge>}
      </p>
      <dl className="glossary-card__fields">
        <dt>한 줄 뜻</dt>
        <dd>{card?.definition ?? basics.definition}</dd>
        {card?.example && (
          <>
            <dt>쉬운 예시</dt>
            <dd>
              {card.example} <span className="glossary-card__note">(가정한 예이고 이 회사의 값이 아니에요)</span>
            </dd>
          </>
        )}
        {card?.whereToCheck && (
          <>
            <dt>확인할 곳</dt>
            <dd>{card.whereToCheck}</dd>
          </>
        )}
        {card?.noJudgment && (
          <>
            <dt>판단하지 않아요</dt>
            <dd>{card.noJudgment}</dd>
          </>
        )}
      </dl>
      {match(cards)
        .with({ status: 'error' }, () => (
          <p className="glossary-card__note" role="status">
            용어 카드를 불러오지 못해 한 줄 뜻만 보여요.
          </p>
        ))
        .otherwise(() => null)}
      <div className="glossary-card__actions">
        <Button variant="secondary" onClick={() => onAsk(easierQuestion(term))}>
          더 쉽게 설명해 줘
        </Button>
        {related.map((name) => (
          <Button key={name} variant="secondary" onClick={() => onAsk(termQuestion(name))}>
            {name}도 알아보기
          </Button>
        ))}
        {sources
          .filter((source) => WEB_URL.test(source.url))
          .map((source) => (
            <ButtonAnchor key={source.url} variant="secondary" href={source.url} target="_blank" rel="noopener noreferrer">
              출처 열기: {source.title}
            </ButtonAnchor>
          ))}
      </div>
    </Card>
  )
}
