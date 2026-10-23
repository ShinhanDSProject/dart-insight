import { useEffect, useRef, useState } from 'react'
import type { Analysis } from '@/shared/api/analyses'
import type { DocumentSide } from '@/shared/api/documents'
import { getTextChange, type TextChangeDetail, type TextSource } from '@/shared/api/textChanges'
import { Button, Notice, Panel, PanelTitle } from '@/shared/ui'
import { DartLinkInline } from '@/shared/ui/DartLink'
import { ErrorState, LoadingState } from '@/shared/ui/StateView'
import { formatDate, reportTypeLabel } from '@/shared/lib/reportLabels'
import { TableView } from './TableView'
import { changeTypeLabel, DELETED_NOTE, missingSideLabel } from '../model/textLabels'
import { wordDiff, type DiffPart } from '../model/wordDiff'

type DetailState = { kind: 'loading' } | { kind: 'done'; detail: TextChangeDetail } | { kind: 'error'; error: unknown }

export interface SourceTarget {
  side: DocumentSide
  section: number
  block: number | null
}

interface TextEvidencePanelProps {
  analysis: Analysis
  changeId: number
  onClose: () => void
  /** 앱 안 원문 확인(3.5)에서 이 위치를 연다 */
  onOpenSource: (target: SourceTarget) => void
}

/**
 * W-03 ③ 문장·표 근거 상세(3.4). 변경 전·후 원문을 나란히 보여 주고, 각 원문의 보고서·종류·기간·항목·위치를 붙인다.
 * 원문이 없거나 짝을 정하지 못한 항목은 근거가 있는 것처럼 보이지 않게 '검토 필요'로 보여 준다.
 */
export function TextEvidencePanel({ analysis, changeId, onClose, onOpenSource }: TextEvidencePanelProps) {
  const [state, setState] = useState<DetailState>({ kind: 'loading' })
  const [retry, setRetry] = useState(0)
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    let cancelled = false
    setState({ kind: 'loading' })
    getTextChange(analysis.analysisId, changeId)
      .then((detail) => {
        if (!cancelled) setState({ kind: 'done', detail })
      })
      .catch((error: unknown) => {
        if (!cancelled) setState({ kind: 'error', error })
      })
    return () => {
      cancelled = true
    }
  }, [analysis.analysisId, changeId, retry])

  // 열리면 제목으로 초점과 화면을 옮긴다(키보드·화면 읽기 사용자)
  useEffect(() => {
    headingRef.current?.focus()
    headingRef.current?.scrollIntoView?.({ block: 'nearest' })
  }, [])

  const headingId = `text-evidence-${changeId}`
  return (
    <Panel className="evidence" aria-labelledby={headingId}>
      <div className="evidence__head">
        <PanelTitle as="h4" id={headingId} ref={headingRef} tabIndex={-1}>
          문장·표 근거
        </PanelTitle>
        <Button variant="secondary" onClick={onClose}>
          닫기
        </Button>
      </div>
      {state.kind === 'loading' && <LoadingState message="원문 근거를 불러오는 중입니다…" />}
      {state.kind === 'error' && (
        <ErrorState
          error={state.error}
          onRetry={() => setRetry((n) => n + 1)}
          messages={{ ANALYSIS_TEXT_CHANGE_NOT_FOUND: '이 분석의 변경 항목이 아니에요. 목록에서 다시 골라 주세요.' }}
        />
      )}
      {state.kind === 'done' && <EvidenceBody detail={state.detail} onOpenSource={onOpenSource} />}
    </Panel>
  )
}

function EvidenceBody({ detail, onOpenSource }: { detail: TextChangeDetail; onOpenSource: (target: SourceTarget) => void }) {
  const { change, previous, current } = detail
  const review = change.changeType === 'REVIEW_NEEDED'
  const bothParagraphs =
    previous?.text != null && current?.text != null && previous.table === null && current.table === null
  const diff = change.changeType === 'MODIFIED' && bothParagraphs ? wordDiff(previous.text!, current.text!) : null
  return (
    <>
      {review && (
        <Notice as="p" tone="attention" role="status">
          검토 필요: {change.reviewReason ?? '두 보고서의 항목을 짝짓지 못했어요.'} 근거 원문을 짝지어 보여 주지 않아요.
          아래 항목 위치에서 두 원문을 직접 확인해 주세요.
        </Notice>
      )}
      <div className="evidence__sources text-evidence__sources">
        <SourceSide
          role="이전 보고서"
          side="previous"
          onOpenSource={onOpenSource}
          source={previous}
          blockType={change.blockType}
          missing={missingSideLabel(change.changeType, 'previous')}
          parts={diff?.previous ?? null}
          review={review}
        />
        <SourceSide
          role="현재 보고서"
          side="current"
          onOpenSource={onOpenSource}
          source={current}
          blockType={change.blockType}
          missing={missingSideLabel(change.changeType, 'current')}
          parts={diff?.current ?? null}
          review={review}
        />
      </div>
      <p className="panel__note">
        변경 유형: {changeTypeLabel(change.changeType)}
        {change.numbersOnly ? ' (숫자만 바뀜)' : ''}
        {change.similarity !== null && change.changeType === 'MODIFIED'
          ? ` · 두 글이 비슷한 정도 ${Math.round(change.similarity * 100)}%`
          : ''}
        {diff ? ' · 바뀐 낱말에 밑줄을 그었어요.' : ''}
      </p>
      {change.changeType === 'DELETED' && <p className="panel__note">{DELETED_NOTE}</p>}
    </>
  )
}

interface SourceSideProps {
  role: string
  side: DocumentSide
  onOpenSource: (target: SourceTarget) => void
  source: TextSource | null
  /** 변경 항목의 종류. 저장된 원문과 맞지 않아 원문 쪽 종류가 없을 때 쓴다 */
  blockType: string
  missing: string
  parts: DiffPart[] | null
  review: boolean
}

function SourceSide({ role, side, onOpenSource, source, blockType, missing, parts, review }: SourceSideProps) {
  if (source === null) {
    return (
      <div className="evidence__source">
        <span className="evidence__role">{role}</span>
        <p className="change-side__missing">{missing}</p>
      </div>
    )
  }
  const position =
    source.blockNo === null
      ? `섹션 ${source.sectionNo} 전체`
      : `${(source.blockType ?? blockType) === 'TABLE' ? '표' : '문단'} 위치 ${source.blockNo}`
  return (
    <div className="evidence__source">
      <span className="evidence__role">{role}</span>
      <span className="evidence__meta">
        {source.reportName} · {reportTypeLabel(source.reportType)} · 대상 기간 끝 {formatDate(source.periodEnd)}
      </span>
      <span className="text-evidence__path">{source.sectionPath}</span>
      <span className="evidence__meta">
        {position} · 접수번호 <code>{source.rceptNo}</code>
        {source.evidenceId && (
          <>
            {' '}
            · 근거 ID <code>{source.evidenceId}</code>
          </>
        )}
      </span>
      {review || source.text === null ? (
        <p className="change-side__missing">
          {review ? '짝을 정하지 못한 항목이라 원문을 짝지어 보여 주지 않아요.' : '원문 글을 찾지 못했어요(검토 필요).'}
        </p>
      ) : source.table ? (
        <TableView rows={source.table} caption={`${role} 표: ${source.sectionPath}`} />
      ) : (
        <p className="text-evidence__text">
          {parts
            ? parts.map((part, i) =>
                part.changed ? (
                  <mark key={i} className="text-evidence__changed">
                    {part.text}
                  </mark>
                ) : (
                  <span key={i}>{part.text}</span>
                ),
              )
            : source.text}
        </p>
      )}
      {!source.blockMatches && source.blockNo !== null && !review && (
        <span className="evidence__meta">
          원문을 다시 읽어 위치가 달라졌을 수 있어 분석할 때 저장한 글을 보여 줘요.
        </span>
      )}
      <div className="text-evidence__links">
        <Button
          variant="link"
          onClick={() => onOpenSource({ side, section: source.sectionNo, block: source.blockMatches ? source.blockNo : null })}
        >
          원문 위치 보기
        </Button>
        <span className="evidence__meta">
          출처: DART · <DartLinkInline rceptNo={source.rceptNo} dartUrl={source.dartUrl} label={`${role} ${source.reportName}`} />
        </span>
      </div>
    </div>
  )
}
