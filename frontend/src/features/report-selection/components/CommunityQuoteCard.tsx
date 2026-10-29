import { Link } from 'react-router'
import type { PostQuote } from '@/shared/api/community'
import { Badge, Button, Notice } from '@/shared/ui'
import { quoteKindLabel, quoteLink, reportPairLabel, type QuotePick } from '../model/postQuote'

interface QuoteViewProps {
  kindLabel: string
  label: string
  text: string
  reportPair: PostQuote['reportPair']
}

/** 인용 카드의 본문: 종류 배지, 섹션 경로(재무는 계정), 글, 보고서 쌍 */
function QuoteView({ kindLabel, label, text, reportPair }: QuoteViewProps) {
  return (
    <>
      <span className="community-quote__head">
        <Badge tone="accent">{kindLabel}</Badge>
        <span className="community-quote__label">{label}</span>
      </span>
      {text !== '' && <span className="community-quote__text">{text}</span>}
      <span className="community-quote__pair">{reportPairLabel(reportPair)}</span>
    </>
  )
}

/**
 * 글에 붙은 변경점(#464). 누르면 결과 화면의 그 변경으로 간다. 내용은 글을 쓸 때 backend가 만든 사본이라,
 * 분석 방식이 바뀌었으면 그 사실을 함께 알린다.
 */
export function CommunityQuoteCard({ quote }: { quote: PostQuote }) {
  const kindLabel = quoteKindLabel(quote)
  return (
    <div className="community-quote">
      <Link className="community-quote__link" to={quoteLink(quote)} aria-label={`${kindLabel} ${quote.label} 분석 결과에서 보기`}>
        <QuoteView kindLabel={kindLabel} label={quote.label} text={quote.text} reportPair={quote.reportPair} />
      </Link>
      {quote.outdated && (
        <Notice as="p" tone="attention" className="community-quote__notice">
          분석 방식이 바뀌어 지금 결과와 다를 수 있어요. 카드 내용은 글을 쓸 때 그대로예요.
        </Notice>
      )}
    </div>
  )
}

/** 글쓰기 칸 아래의 붙일 변경점 미리보기. 올리면 backend가 저장된 분석 결과로 다시 만든다 */
export function QuotePreview({ pick, onRemove, disabled }: { pick: QuotePick; onRemove: () => void; disabled: boolean }) {
  return (
    <div className="community-quote community-quote--preview">
      <div className="community-quote__link">
        <QuoteView kindLabel={pick.kindLabel} label={pick.label} text={pick.text} reportPair={pick.reportPair} />
      </div>
      <Button variant="link" className="community-quote__remove" onClick={onRemove} disabled={disabled}>
        붙인 변경점 빼기
      </Button>
    </div>
  )
}
