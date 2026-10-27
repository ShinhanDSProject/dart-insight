import { useState } from 'react'
import { match } from 'ts-pattern'
import { NOTE_MEMO_MAX, type NoteItem } from '@/shared/api/notes'
import { verifiedDartUrl } from '@/shared/lib/dart'
import { Badge, Button, ButtonAnchor, ButtonLink, Card, MemoForm, Notice } from '@/shared/ui'
import { AlertState } from '@/shared/ui/StateView'
import { noteKindLabel, noteLocation, noteResultLink, noteTime, OUTDATED_NOTE } from '../model/notes'

interface NoteItemCardProps {
  item: NoteItem
  onSaveMemo: (itemId: number, memo: string | null) => Promise<void>
  onRemove: (itemId: number) => Promise<void>
}

/** viewing: 보기, editing: 메모 고치는 중, saving·removing: 서버가 답하기를 기다림 */
type CardState =
  | { status: 'viewing'; failed: 'remove' | null }
  | { status: 'editing'; failed: boolean }
  | { status: 'saving' }
  | { status: 'removing' }

/**
 * 노트 항목 하나. 담을 때의 이름·값·문장(사본)과 메모, 원래 위치로 돌아가는 링크, DART 원문, 지우기.
 * 분석 버전이 바뀌었으면(AC4) 위치가 달라졌을 수 있다고 알리고, 담은 값은 그대로 보인다.
 */
export function NoteItemCard({ item, onSaveMemo, onRemove }: NoteItemCardProps) {
  const [card, setCard] = useState<CardState>({ status: 'viewing', failed: null })
  const link = noteResultLink(item)
  const location = noteLocation(item)
  const dartUrl = item.source.rceptNo === null ? null : verifiedDartUrl(item.source.rceptNo, item.source.dartUrl)

  const saveMemo = (memo: string | null) => {
    setCard({ status: 'saving' })
    onSaveMemo(item.itemId, memo).then(
      () => setCard({ status: 'viewing', failed: null }),
      () => setCard({ status: 'editing', failed: true }),
    )
  }
  const remove = () => {
    setCard({ status: 'removing' })
    // 지우면 목록에서 빠져 이 카드가 사라진다. 실패했을 때만 상태를 되돌린다
    onRemove(item.itemId).catch(() => setCard({ status: 'viewing', failed: 'remove' }))
  }

  return (
    <Card as="article" className="note-item" aria-label={`${item.label} 노트`}>
      <div className="note-item__head">
        <h3 className="note-item__title">{item.label}</h3>
        <Badge tone="accent">{noteKindLabel(item)}</Badge>
      </div>
      {item.outdated && (
        <Notice as="p" tone="attention">
          {OUTDATED_NOTE}. 담은 값은 담을 때 그대로예요.
        </Notice>
      )}
      {match(item.kind)
        .with('FINANCIAL_CHANGE', () => <p className="note-item__value">{item.text}</p>)
        .with('TEXT_CHANGE', () => <blockquote className="note-item__quote">{item.text}</blockquote>)
        .exhaustive()}
      <p className="note-item__meta">
        {location !== null && <span>{location}</span>}
        <span>담은 시각 {noteTime(item.createdAt)}</span>
      </p>

      {match(card)
        .with({ status: 'editing' }, { status: 'saving' }, (state) => (
          <MemoForm
            initial={item.memo}
            maxLength={NOTE_MEMO_MAX}
            submitLabel="메모 저장"
            saving={state.status === 'saving'}
            onSave={saveMemo}
            onCancel={() => setCard({ status: 'viewing', failed: null })}
            error={
              state.status === 'editing' && state.failed ? (
                <AlertState title="메모를 저장하지 못했어요.">잠시 뒤 다시 시도해 주세요.</AlertState>
              ) : undefined
            }
          />
        ))
        .with({ status: 'viewing' }, { status: 'removing' }, (state) => (
          <>
            <div className="note-item__memo">
              <span className="note-item__memo-label">메모</span>
              <p>{item.memo ?? '메모가 없어요.'}</p>
            </div>
            <div className="note-item__actions">
              {link !== null && (
                <ButtonLink variant="secondary" to={link}>
                  원래 위치 보기
                </ButtonLink>
              )}
              {dartUrl !== null && (
                <ButtonAnchor variant="secondary" href={dartUrl} target="_blank" rel="noopener noreferrer">
                  DART 원문 <span aria-hidden="true">↗</span>
                  <span className="visually-hidden">(새 창)</span>
                </ButtonAnchor>
              )}
              <Button
                variant="secondary"
                disabled={state.status === 'removing'}
                onClick={() => setCard({ status: 'editing', failed: false })}
              >
                {item.memo === null ? '메모 쓰기' : '메모 고치기'}
              </Button>
              <Button
                variant="secondary"
                disabled={state.status === 'removing'}
                aria-label={`지우기: ${item.label}`}
                onClick={remove}
              >
                {state.status === 'removing' ? '지우는 중…' : '지우기'}
              </Button>
            </div>
            {state.status === 'viewing' && state.failed === 'remove' && (
              <AlertState title="항목을 지우지 못했어요.">잠시 뒤 다시 시도해 주세요.</AlertState>
            )}
          </>
        ))
        .exhaustive()}
    </Card>
  )
}
