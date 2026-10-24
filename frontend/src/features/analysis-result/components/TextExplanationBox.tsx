import { match } from 'ts-pattern'
import type { Analysis } from '@/shared/api/analyses'
import type { TextExplanation } from '@/shared/api/textChanges'
import { displaySectionPath } from '@/shared/lib/sectionTitle'
import { Badge, Button, Icon, Notice } from '@/shared/ui'
import { ErrorState } from '@/shared/ui/StateView'
import { CopyWithSourcesButton } from './CopyWithSourcesButton'
import type { SourceTarget } from '../model/resultParams'
import { explanationCopyText } from '../model/copyText'
import { aiInfoLabel } from '../model/summaryLabels'
import {
  EXPLANATION_NO_SOURCE_DEFAULT,
  EXPLANATION_NOTE,
  EXPLANATION_REVIEW_DEFAULT,
  explanationErrorMessages,
  explanationSideLabel,
  explanationTarget,
  orderedEvidence,
  type ExplanationEntry,
} from '../model/textExplanation'

interface TextExplanationBoxProps {
  id: string
  entry: ExplanationEntry
  analysis: Analysis
  onRetry: () => void
  onOpenSource: (target: SourceTarget) => void
}

/**
 * 문장 카드 안의 AI 한 줄 풀이(3.11, W-03 ③). 기다림 → 풀이·검토 필요·원문 없음·오류 가운데 하나를 보인다.
 * 바뀐 내용은 화면 읽기 프로그램에 알린다(aria-live).
 */
export function TextExplanationBox({ id, entry, analysis, onRetry, onOpenSource }: TextExplanationBoxProps) {
  const busy = entry.status === 'idle' || entry.status === 'loading'
  return (
    // 여러 카드에서 함께 펼칠 수 있어 랜드마크(section)가 아니라 이름 붙은 묶음(group)으로 둔다
    <div id={id} className="text-explain" role="group" aria-label="AI 한 줄 풀이" aria-live="polite" aria-busy={busy}>
      {match(entry)
        // 펼치자마자 부르므로 idle은 한 순간뿐이다. 기다림과 같이 보인다
        .with({ status: 'idle' }, { status: 'loading' }, () => <ExplanationPending />)
        .with({ status: 'error' }, ({ error }) => (
          <div className="text-explain__body">
            <ErrorState error={error} onRetry={onRetry} messages={explanationErrorMessages} />
          </div>
        ))
        .with({ status: 'success' }, ({ data }) => (
          <div className="text-explain__body">
            <ExplanationBody explanation={data} analysis={analysis} onOpenSource={onOpenSource} />
          </div>
        ))
        .exhaustive()}
    </div>
  )
}

function ExplanationPending() {
  return (
    <div className="text-explain__pending">
      <span className="answer-pending__label">
        <span className="answer-pending__dot" aria-hidden="true" />
        원문을 읽고 풀이하는 중…
      </span>
      <span className="text-explain__skeleton ask-skeleton" aria-hidden="true" />
    </div>
  )
}

function ExplanationBody({
  explanation,
  analysis,
  onOpenSource,
}: {
  explanation: TextExplanation
  analysis: Analysis
  onOpenSource: (target: SourceTarget) => void
}) {
  return match(explanation.status)
    .with('OK', () => (
      <>
        <div className="text-explain__answer">
          <Badge tone="accent">AI 생성</Badge>
          <p className="text-explain__sentence">{explanation.sentence}</p>
        </div>
        <EvidenceRow explanation={explanation} analysis={analysis} onOpenSource={onOpenSource} />
        <p className="text-explain__note">{EXPLANATION_NOTE}</p>
        <CopyWithSourcesButton
          className="text-explain__copy"
          text={() =>
            explanationCopyText(explanation, { previous: analysis.previous.reportName, current: analysis.current.reportName })
          }
          target="풀이"
        />
        <AiMeta explanation={explanation} />
      </>
    ))
    .with('REVIEW_NEEDED', () => (
      <>
        <Notice tone="attention" className="text-explain__notice" title="검토 필요">
          <p>{explanation.message ?? EXPLANATION_REVIEW_DEFAULT}</p>
        </Notice>
        <AiMeta explanation={explanation} />
      </>
    ))
    .with('NO_SOURCE', () => (
      <Notice className="text-explain__notice" title="풀이할 원문이 없어요">
        <p>{explanation.message ?? EXPLANATION_NO_SOURCE_DEFAULT}</p>
      </Notice>
    ))
    .exhaustive()
}

function AiMeta({ explanation }: { explanation: TextExplanation }) {
  if (!explanation.ai) return null
  return (
    <details className="text-explain__meta">
      <summary>생성 정보</summary>
      {aiInfoLabel(explanation.ai)}
    </details>
  )
}

/**
 * 풀이가 인용한 원문. 누르면 원문 확인 탭의 그 위치를 연다. 섹션 경로를 함께 적는다.
 * 섹션 번호를 찾지 못했으면 누를 수 없는 글자로 근거 ID만 보인다.
 */
function EvidenceRow({
  explanation,
  analysis,
  onOpenSource,
}: {
  explanation: TextExplanation
  analysis: Analysis
  onOpenSource: (target: SourceTarget) => void
}) {
  const evidence = orderedEvidence(explanation.evidence)
  if (evidence.length === 0) return null
  const labelId = `text-explain-evidence-${explanation.changeId}`
  return (
    <div className="text-explain__evidence">
      <span className="text-explain__label" id={labelId}>
        근거
      </span>
      <ul className="text-explain__sources" aria-labelledby={labelId}>
        {evidence.map((e) => {
          const target = explanationTarget(e)
          const label = explanationSideLabel(e.side)
          const path = e.sectionPath === null ? null : displaySectionPath(e.sectionPath)
          const reportName = e.side === 'current' ? analysis.current.reportName : analysis.previous.reportName
          return (
            <li key={e.evidenceId}>
              {target ? (
                <Button
                  variant="secondary"
                  className="text-explain__source"
                  title={path ? `${path} · 근거 ID ${e.evidenceId}` : `근거 ID ${e.evidenceId}`}
                  onClick={() => onOpenSource(target)}
                >
                  <span className="text-explain__side">{label}</span>
                  {path && <span className="text-explain__path">{path}</span>}
                  <span className="visually-hidden"> 위치 보기 ({reportName})</span>
                  <Icon name="chevron-right" size={14} />
                </Button>
              ) : (
                <span className="text-explain__source text-explain__source--static">
                  {label}
                  {path && ` · ${path}`} · 근거 <code>{e.evidenceId}</code>
                </span>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
