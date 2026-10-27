import { useId } from 'react'
import { match } from 'ts-pattern'
import type { DisclosureSignals } from '@/shared/api/disclosureSignals'
import { verifiedDartUrl } from '@/shared/lib/dart'
import { formatDate } from '@/shared/lib/reportLabels'
import { Badge, Button, Panel, PanelTitle } from '@/shared/ui'
import { EmptyState, ErrorState, LoadingState } from '@/shared/ui/StateView'
import { useDisclosureSignals } from '../hooks/useDisclosureSignals'
import { signalsView, type SignalItemView, type SignalKindLine } from '../model/disclosureSignals'
import '../report-selection.css'

const errorMessages: Record<string, string> = {
  COMPANY_NOT_FOUND: '없는 기업이에요. 검색에서 다시 골라 주세요.',
}

/**
 * 기업 개요 탭의 '확인해 볼 공시'(FS-55, #411). 최근 1년 공시 가운데 정해 둔 종류만 모아 종류별 건수, 사실 문장,
 * DART 원문 링크를 보여 준다. 점수·등급·평가 문구는 쓰지 않는다. 자료를 받지 못한 종류는 '확인하지 못했어요'로
 * 0건과 나눠 보여 준다.
 */
export function DisclosureSignalsSection({ corpCode }: { corpCode: string }) {
  const { state, reload } = useDisclosureSignals(corpCode)
  const titleId = useId()

  return (
    <Panel className="disclosure-signals" aria-labelledby={titleId}>
      <PanelTitle id={titleId}>확인해 볼 공시</PanelTitle>
      {match(state)
        .with({ status: 'loading' }, () => <LoadingState message="확인해 볼 공시를 불러오는 중이에요…" />)
        .with({ status: 'error' }, ({ error }) => (
          <ErrorState error={error} onRetry={reload} messages={errorMessages} />
        ))
        .with({ status: 'success' }, ({ data }) => <DisclosureSignalsView signals={data} onRetry={reload} />)
        .exhaustive()}
    </Panel>
  )
}

export function DisclosureSignalsView({ signals, onRetry }: { signals: DisclosureSignals; onRetry: () => void }) {
  const view = signalsView(signals)
  return (
    <div className="disclosure-signals__body">
      <p className="panel__note">
        {formatDate(signals.from)} ~ {formatDate(signals.to)}에 접수된 공시에서 아래 종류를 확인했어요. 종류는 공시
        제목과 사업보고서의 감사의견으로 나눈 것이라, 내용은 원문으로 확인해 주세요.
      </p>
      <KindLines lines={view.lines} onRetry={onRetry} />
      {match(view)
        .with({ kind: 'list' }, ({ items }) => (
          <ul className="disclosure-signals__items">
            {items.map((item) => (
              <SignalRow key={`${item.kind}-${item.rceptNo}`} item={item} />
            ))}
          </ul>
        ))
        .with({ kind: 'empty' }, () => <EmptyState title="해당 공시가 없어요" />)
        .with({ kind: 'unchecked' }, () => (
          <EmptyState title="확인한 종류에는 해당 공시가 없어요">
            <p>확인하지 못한 종류는 다시 시도해 주세요.</p>
          </EmptyState>
        ))
        .exhaustive()}
    </div>
  )
}

function KindLines({ lines, onRetry }: { lines: SignalKindLine[]; onRetry: () => void }) {
  return (
    <ul className="disclosure-signals__kinds" aria-label="종류별 건수">
      {lines.map((line) => (
        <li key={line.kind} className="disclosure-signals__kind">
          <span className="disclosure-signals__kind-label">{line.label}</span>
          {match(line)
            .with({ status: 'found' }, ({ count }) => <span className="disclosure-signals__count">{count}건</span>)
            .with({ status: 'none' }, () => <span className="disclosure-signals__count">0건</span>)
            .with({ status: 'unavailable' }, ({ label }) => (
              <span className="disclosure-signals__count">
                확인하지 못했어요 ·{' '}
                <Button variant="link" onClick={onRetry}>
                  다시 시도<span className="visually-hidden"> ({label})</span>
                </Button>
              </span>
            ))
            .exhaustive()}
        </li>
      ))}
    </ul>
  )
}

function SignalRow({ item }: { item: SignalItemView }) {
  const url = verifiedDartUrl(item.rceptNo, item.dartUrl)
  return (
    <li className="disclosure-signals__item">
      <Badge>{item.label}</Badge>
      <div className="disclosure-signals__main">
        <p className="disclosure-signals__sentence">{item.sentence}</p>
        <span className="disclosure-signals__meta">
          <time dateTime={item.receivedDate}>{formatDate(item.receivedDate)}</time> ·{' '}
          {url === null ? (
            <>
              {item.reportName}{' '}
              <span className="dart-link__help">(원문 링크 확인 안 됨, 접수번호 {item.rceptNo})</span>
            </>
          ) : (
            <a className="list-link" href={url} target="_blank" rel="noopener noreferrer">
              {item.reportName} <span aria-hidden="true">↗</span>
              <span className="visually-hidden">(DART 원문 새 창)</span>
            </a>
          )}
        </span>
      </div>
    </li>
  )
}
