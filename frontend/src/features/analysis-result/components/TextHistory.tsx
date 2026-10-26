import { useState } from 'react'
import { match } from 'ts-pattern'
import type { TextHistoryEntry } from '@/shared/api/textChanges'
import { Badge, Button } from '@/shared/ui'
import { ErrorState, LoadingState } from '@/shared/ui/StateView'
import { formatDate, reportTypeLabel } from '@/shared/lib/reportLabels'
import { displaySectionPath } from '@/shared/lib/sectionTitle'
import { useTextChangeHistory } from '../hooks/useTextChanges'
import { historyView } from '../model/textHistory'

interface TextHistoryProps {
  analysisId: number
  changeId: number
}

/**
 * 문장 변경 이력(3.8). 근거 상세 아래에서 열면 이미 완료된 분석을 이어 붙여 여러 기간을 오래된 것부터 보여 준다.
 * 열기 전에는 불러오지 않는다. 분석하지 않은 기간·검토 필요는 '변경 없음'처럼 보이지 않게 따로 표시한다(ADR-0028).
 */
export function TextHistory({ analysisId, changeId }: TextHistoryProps) {
  const [open, setOpen] = useState(false)
  const listId = `text-history-${changeId}`
  return (
    <section className="text-history" aria-label="여러 기간 이력">
      <Button variant="secondary" aria-expanded={open} aria-controls={listId} onClick={() => setOpen((v) => !v)}>
        {open ? '여러 기간 이력 닫기' : '여러 기간 이력 보기'}
      </Button>
      {open && (
        <div id={listId}>
          <HistoryBody analysisId={analysisId} changeId={changeId} />
        </div>
      )}
    </section>
  )
}

function HistoryBody({ analysisId, changeId }: TextHistoryProps) {
  const { state, reload } = useTextChangeHistory(analysisId, changeId)
  return match(state)
    .with({ status: 'loading' }, () => <LoadingState message="여러 기간 이력을 불러오는 중입니다…" />)
    .with({ status: 'error' }, ({ error }) => (
      <ErrorState
        error={error}
        onRetry={reload}
        messages={{ ANALYSIS_TEXT_CHANGE_NOT_FOUND: '이 분석의 변경 항목이 아니에요. 목록에서 다시 골라 주세요.' }}
      />
    ))
    .with({ status: 'success' }, ({ data }) => (
      <>
        <p className="panel__note">
          이미 분석한 비교만 이어 붙였어요. 분석하지 않은 기간은 &lsquo;분석 안 됨&rsquo;으로 표시해요.
        </p>
        <ol className="text-history__list">
          {data.entries.map((entry) => (
            <HistoryItem key={entry.report.rceptNo} entry={entry} />
          ))}
        </ol>
      </>
    ))
    .exhaustive()
}

function HistoryItem({ entry }: { entry: TextHistoryEntry }) {
  const view = historyView(entry)
  const { report } = entry
  return (
    <li className="text-history__item">
      <div className="text-history__head">
        <span className="evidence__meta">
          {report.reportName} · {reportTypeLabel(report.reportType)} · 대상 기간 끝 {formatDate(report.periodEnd)}
        </span>
        <Badge tone={view.tone}>{view.label}</Badge>
      </div>
      {entry.text !== null && entry.evidenceId !== null ? (
        <>
          <p className="text-evidence__text">{entry.text}</p>
          <span className="evidence__meta">
            {entry.sectionPath && <>{displaySectionPath(entry.sectionPath)} · </>}
            접수번호 <code>{report.rceptNo}</code> · 근거 ID <code>{entry.evidenceId}</code>
          </span>
        </>
      ) : (
        <span className="evidence__meta">
          {view.note} 접수번호 <code>{report.rceptNo}</code>
        </span>
      )}
    </li>
  )
}
