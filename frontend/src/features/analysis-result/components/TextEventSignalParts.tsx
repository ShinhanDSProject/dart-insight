import { match } from 'ts-pattern'
import type { SignalTable, TextEventItem } from '@/shared/api/textEvents'
import type { LoadState } from '@/shared/hooks/asyncState'
import { Badge, Button, DataTable, DataTableRow, Dialog } from '@/shared/ui'
import { ErrorState, LoadingState } from '@/shared/ui/StateView'
import {
  ABSENT_SCOPE_LABEL,
  CRITERIA_BUTTON,
  CRITERIA_LOADING,
  CRITERIA_NOTE,
  CRITERIA_TITLE,
  criteriaRows,
  FALLBACK_NOTE,
  GLOSSARY_TITLE,
  JUDGMENT_LABEL,
  MEANING_TITLE,
  meaningView,
  SIGNAL_REASON_TITLE,
  signalReasonView,
  type SentenceLine,
  type SentenceSource,
} from '../model/eventSignal'

type OpenEvidence = (changeId: number) => void

function SourceLink({ source, onOpenEvidence }: { source: SentenceSource; onOpenEvidence: OpenEvidence }) {
  const { changeId, evidenceId, label } = source
  if (changeId === null) return <span title={`근거 ID ${evidenceId}`}>{label}</span>
  return (
    <Button variant="link" aria-haspopup="dialog" title={`근거 ID ${evidenceId}`} onClick={() => onOpenEvidence(changeId)}>
      {label} · 원문 비교
    </Button>
  )
}

/** 문장 하나와 그 원문 위치. 같은 블록을 인용한 변경이 있으면 원문 비교를 연다 */
function SentenceLines({ lines, onOpenEvidence }: { lines: SentenceLine[]; onOpenEvidence: OpenEvidence }) {
  if (lines.length === 0) return null
  return (
    <ul className="text-event__sentences">
      {lines.map((line, index) => (
        <li key={index} className="text-event__sentence">
          <p>
            {line.label !== null && <strong className="text-event__side">{line.label}</strong>}
            {line.text}
          </p>
          {line.sources.length > 0 && (
            <p className="text-event__source">
              {line.scope && <span>{ABSENT_SCOPE_LABEL}:</span>}
              {line.sources.map((source) => (
                <SourceLink key={source.evidenceId} source={source} onOpenEvidence={onOpenEvidence} />
              ))}
            </p>
          )}
        </li>
      ))}
    </ul>
  )
}

/** 공시의 의미와 용어 풀이(AC15, AC16). 의미가 실패하면 용어 풀이만, 둘 다 없으면 아무것도 그리지 않는다 */
export function MeaningPart({ item, onOpenEvidence }: { item: TextEventItem; onOpenEvidence: OpenEvidence }) {
  const view = meaningView(item)
  if (view === null) return null
  const meaningId = `text-event-meaning-${item.eventId}`
  const glossaryId = `text-event-glossary-${item.eventId}`
  return (
    <>
      {view.aiGenerated && (
        <section className="text-event__part" aria-labelledby={meaningId}>
          <h5 id={meaningId} className="text-event__part-title">
            {MEANING_TITLE} <Badge tone="accent">AI 생성</Badge>
          </h5>
          <SentenceLines lines={view.lines} onOpenEvidence={onOpenEvidence} />
        </section>
      )}
      {view.glossary.length > 0 && (
        <section className="text-event__part" aria-labelledby={glossaryId}>
          <h5 id={glossaryId} className="text-event__part-title text-event__part-title--minor">
            {GLOSSARY_TITLE}
          </h5>
          <dl className="text-event__glossary">
            {view.glossary.map((term) => (
              <div key={term.term}>
                <dt>{term.term}</dt>
                <dd>
                  {term.meaning} <span className="text-event__term-source">출처: {term.source}</span>
                </dd>
              </div>
            ))}
          </dl>
        </section>
      )}
    </>
  )
}

interface SignalReasonPartProps {
  item: TextEventItem
  onOpenEvidence: OpenEvidence
  onOpenCriteria: () => void
}

/** 신호 이유(AC14, AC17~AC20). 판정 줄은 코드가 만들고, 그 아래 근거는 AI 문장이거나 실패 때의 일반 문구다 */
export function SignalReasonPart({ item, onOpenEvidence, onOpenCriteria }: SignalReasonPartProps) {
  const view = signalReasonView(item)
  const titleId = `text-event-signal-reason-${item.eventId}`
  return (
    <section className="text-event__part" aria-labelledby={titleId}>
      <h5 id={titleId} className="text-event__part-title">
        {SIGNAL_REASON_TITLE} {view.aiGenerated && <Badge tone="accent">AI 생성</Badge>}
      </h5>
      {view.firstLine !== null && <p className="text-event__first-line">{view.firstLine}</p>}
      {view.judgment !== null && (
        <p className="text-event__judgment">
          <span className="text-event__judgment-label">{JUDGMENT_LABEL}</span> {view.judgment}
        </p>
      )}
      {view.rowCounts !== null && <p className="panel__note">{view.rowCounts}</p>}
      <SentenceLines lines={view.lines} onOpenEvidence={onOpenEvidence} />
      {view.fallbackNote && <p className="panel__note">{FALLBACK_NOTE}</p>}
      <Button variant="link" className="text-event__actions" aria-haspopup="dialog" onClick={onOpenCriteria}>
        {CRITERIA_BUTTON}
      </Button>
    </section>
  )
}

interface SignalCriteriaDialogProps {
  item: TextEventItem
  table: LoadState<SignalTable>
  onRetry: () => void
  onClose: () => void
}

/** '기준 보기'로 여는 기준표. 이 사건의 종류·변화 줄을 표시한다 */
export function SignalCriteriaDialog({ item, table, onRetry, onClose }: SignalCriteriaDialogProps) {
  return (
    <Dialog titleId="signal-criteria-title" title={CRITERIA_TITLE} onClose={onClose} className="signal-criteria">
      {match(table)
        .with({ status: 'loading' }, () => <LoadingState message={CRITERIA_LOADING} />)
        .with({ status: 'error' }, ({ error }) => <ErrorState error={error} onRetry={onRetry} />)
        .with({ status: 'success' }, ({ data }) => (
          <>
            <p>{data.signalNotice}</p>
            <p className="panel__note">{CRITERIA_NOTE}</p>
            <DataTable caption={`${CRITERIA_TITLE} (${data.version})`} density="dense" scrollClassName="signal-criteria__table">
              <thead>
                <tr>
                  <th scope="col">사건 종류</th>
                  <th scope="col">변화</th>
                  <th scope="col">신호</th>
                </tr>
              </thead>
              <tbody>
                {criteriaRows(data, item).map((row) => (
                  <DataTableRow key={row.key} selected={row.current}>
                    <td>{row.kind}</td>
                    <td>{row.change}</td>
                    <td>
                      {row.signal}
                      {row.current && <Badge tone="accent">이 사건</Badge>}
                    </td>
                  </DataTableRow>
                ))}
              </tbody>
            </DataTable>
          </>
        ))
        .exhaustive()}
    </Dialog>
  )
}
