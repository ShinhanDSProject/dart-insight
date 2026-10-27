import { useState } from 'react'
import { match } from 'ts-pattern'
import type { RelatedDisclosure, TextChangeRelatedDisclosures } from '@/shared/api/textChanges'
import { Badge, Button, Notice } from '@/shared/ui'
import { DartLinkInline } from '@/shared/ui/DartLink'
import { ErrorState, LoadingState } from '@/shared/ui/StateView'
import { formatDate } from '@/shared/lib/reportLabels'
import { useRelatedDisclosures } from '../hooks/useTextChanges'
import { matchLevelLabel, splitRelated, timingLabel } from '../model/relatedDisclosures'

interface RelatedDisclosuresProps {
  analysisId: number
  changeId: number
}

/**
 * 관련 수시공시(보조 근거, 3.6·FS-54). 근거 상세 맨 아래에서 열면 같은 기간에 이 변경과 같은 규칙에 걸린 수시공시를 보여 준다.
 * 열기 전에는 불러오지 않는다. 정기보고서 근거와 구분되게 회색 칸에 '보조' 표시를 붙이고, 원인이라고 말하지 않는다.
 * 규칙으로 고른 결과라 'AI 생성' 표시를 붙이지 않는다.
 */
export function RelatedDisclosures({ analysisId, changeId }: RelatedDisclosuresProps) {
  const [open, setOpen] = useState(false)
  const bodyId = `related-disclosures-${changeId}`
  return (
    <section className="related-disclosures" aria-label="관련 수시공시(보조)">
      <Button variant="secondary" aria-expanded={open} aria-controls={bodyId} onClick={() => setOpen((v) => !v)}>
        {open ? '관련 수시공시(보조) 닫기' : '관련 수시공시(보조) 보기'}
      </Button>
      {open && (
        <div id={bodyId} className="related-disclosures__box">
          <div className="related-disclosures__head">
            <Badge>보조</Badge>
            <span className="evidence__meta">정기보고서 밖의 공시예요. 위 정기보고서 근거와 따로 보세요.</span>
          </div>
          <RelatedBody analysisId={analysisId} changeId={changeId} />
        </div>
      )}
    </section>
  )
}

function RelatedBody({ analysisId, changeId }: RelatedDisclosuresProps) {
  const { state, reload } = useRelatedDisclosures(analysisId, changeId)
  return match(state)
    .with({ status: 'loading' }, () => (
      <LoadingState message="관련 수시공시를 찾는 중입니다… 처음에는 몇 초 걸릴 수 있어요." />
    ))
    .with({ status: 'error' }, ({ error }) => (
      <ErrorState
        error={error}
        onRetry={reload}
        messages={{ ANALYSIS_TEXT_CHANGE_NOT_FOUND: '이 분석의 변경 항목이 아니에요. 목록에서 다시 골라 주세요.' }}
      />
    ))
    .with({ status: 'success' }, ({ data }) => (
      <>
        <RelatedResult data={data} onRetry={reload} />
        <p className="panel__note">{data.notice}</p>
      </>
    ))
    .exhaustive()
}

function RelatedResult({ data, onRetry }: { data: TextChangeRelatedDisclosures; onRetry: () => void }) {
  const { window } = data
  const period = (
    <span className="evidence__meta">
      찾아본 기간 {formatDate(window.from)} ~ {formatDate(window.to)} (보고 기간 끝 {formatDate(window.periodEnd)})
    </span>
  )
  return match(data.status)
    .with('FOUND', () => (
      <>
        {period}
        {data.partial && (
          <p className="panel__note">
            공시의 주요 정보를 지금 불러오지 못해 &lsquo;같은 종류&rsquo;로만 보여 줘요. 나중에 다시 열면 내용까지 맞춰 봐요.
          </p>
        )}
        <RelatedList items={data.items} />
      </>
    ))
    .with('NOT_FOUND', () => (
      <>
        {period}
        <p className="related-disclosures__empty">이 기간에 이 항목과 연결된 수시공시를 찾지 못했습니다.</p>
        <span className="evidence__meta">정해 둔 규칙으로 찾지 못한 것이고, 공시가 없다는 뜻은 아니에요.</span>
      </>
    ))
    .with('UNAVAILABLE', () => (
      <Notice tone="attention" role="status" title="공시 목록을 지금 불러오지 못했습니다.">
        <p>DART에서 공시 목록을 받지 못했어요. 잠시 뒤 다시 시도해 주세요.</p>
        <Button variant="secondary" onClick={onRetry}>
          다시 시도
        </Button>
      </Notice>
    ))
    .exhaustive()
}

function RelatedList({ items }: { items: RelatedDisclosure[] }) {
  const [expanded, setExpanded] = useState(false)
  const { shown, hidden } = splitRelated(items)
  const visible = expanded ? items : shown
  return (
    <>
      <ul className="related-disclosures__list">
        {visible.map((item) => (
          <RelatedItem key={item.rceptNo} item={item} />
        ))}
      </ul>
      {hidden.length > 0 && (
        <Button variant="link" aria-expanded={expanded} onClick={() => setExpanded((v) => !v)}>
          {expanded ? '같은 종류 공시 접기' : `같은 종류 공시 ${hidden.length}건 더 보기`}
        </Button>
      )}
    </>
  )
}

function RelatedItem({ item }: { item: RelatedDisclosure }) {
  const corrected = item.latestRceptNo !== item.rceptNo
  return (
    <li className="related-disclosures__item">
      <div className="related-disclosures__title">
        <span>{item.reportName}</span>
        <Badge>{timingLabel(item.timing)}</Badge>
        <Badge tone={item.matchLevel === 'STRONG' ? 'accent' : 'neutral'}>{matchLevelLabel(item)}</Badge>
      </div>
      <span className="evidence__meta">
        접수일 {formatDate(item.receivedDate)} · 연결 이유: &lsquo;{item.matchRuleLabel}&rsquo; 규칙 · 접수번호{' '}
        <code>{item.rceptNo}</code>
      </span>
      <span className="evidence__meta">
        출처: DART · <DartLinkInline rceptNo={item.latestRceptNo} dartUrl={item.dartUrl} label={item.reportName} />
        {corrected && (
          <>
            {' '}
            (최신 정정본 <code>{item.latestRceptNo}</code>의 원문을 열어요)
          </>
        )}
      </span>
    </li>
  )
}
