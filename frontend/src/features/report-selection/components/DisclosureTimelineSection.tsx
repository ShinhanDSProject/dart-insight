import { useId, useReducer } from 'react'
import { Link } from 'react-router'
import { match } from 'ts-pattern'
import type { DisclosureGroup, DisclosureItem, DisclosureList } from '@/shared/api/disclosures'
import { verifiedDartUrl } from '@/shared/lib/dart'
import { formatDate } from '@/shared/lib/reportLabels'
import { Badge, Button, Chip, Notice, Panel, PanelTitle } from '@/shared/ui'
import { EmptyState, ErrorState, LoadingState } from '@/shared/ui/StateView'
import { useCompanyDisclosures } from '../hooks/useCompanyDisclosures'
import {
  compareWithReportPath,
  groupChips,
  INITIAL_TIMELINE,
  TIMELINE_PAGE_SIZE,
  timelineReducer,
  timelineView,
} from '../model/disclosureTimeline'
import '../report-selection.css'

const errorMessages: Record<string, string> = {
  COMPANY_NOT_FOUND: '없는 기업이에요. 검색에서 다시 골라 주세요.',
  DART_RATE_LIMITED: 'OpenDART 호출 한도를 넘어 최근 공시를 받지 못했어요. 내일 다시 시도해 주세요.',
  DART_REQUEST_FAILED: 'OpenDART에서 최근 공시를 받지 못했어요. 잠시 뒤 다시 시도해 주세요.',
  DART_KEY_MISSING: '서버에 OpenDART 키가 설정되지 않았어요. 관리자에게 알려 주세요.',
}

const refreshErrorMessages: Record<string, string> = {
  DART_RATE_LIMITED: 'OpenDART 호출 한도를 넘었어요',
  DART_REQUEST_FAILED: 'OpenDART에 연결하지 못했어요',
}

/**
 * 기업 개요 탭의 '최근 공시' 영역(FS-48, #332). 최근 90일 공시를 접수일별 타임라인으로 보여 주고 묶음으로 거른다.
 * 각 공시는 DART 원문(새 창)으로 이어지고, 비교할 수 있는 정기보고서는 '이 보고서로 비교하기'로 보고서 비교에 연다.
 */
export function DisclosureTimelineSection({ corpCode }: { corpCode: string }) {
  const { state, reload } = useCompanyDisclosures(corpCode)
  const titleId = useId()

  return (
    <Panel className="disclosure-timeline" aria-labelledby={titleId}>
      <PanelTitle id={titleId}>최근 공시</PanelTitle>
      {match(state)
        .with({ status: 'loading' }, () => <LoadingState message="최근 공시를 불러오는 중이에요…" />)
        .with({ status: 'error' }, ({ error }) => (
          <ErrorState error={error} onRetry={reload} messages={errorMessages} />
        ))
        .with({ status: 'success' }, ({ data }) => <DisclosureTimeline corpCode={corpCode} list={data} />)
        .exhaustive()}
    </Panel>
  )
}

export function DisclosureTimeline({ corpCode, list }: { corpCode: string; list: DisclosureList }) {
  const [timeline, dispatch] = useReducer(timelineReducer, INITIAL_TIMELINE)
  const view = timelineView(list.items, timeline)
  const chips = groupChips(list.groups)

  return (
    <div className="disclosure-timeline__body">
      <p className="panel__note">
        {formatDate(list.from)} ~ {formatDate(list.to)}에 접수된 공시예요(OpenDART 공시검색, 정정 전 공시는 빼고 최종본만).
        {list.fetchedAt && ` ${fetchedLabel(list.fetchedAt)}에 받았어요.`}
      </p>
      {list.refreshError && (
        <Notice tone="attention" role="status">
          {refreshNotice(list)}
        </Notice>
      )}
      <div className="disclosure-timeline__filters" role="group" aria-label="공시 묶음">
        {chips.map((chip) => (
          <Chip
            key={chip.group ?? 'ALL'}
            pressed={timeline.group === chip.group}
            count={chip.count}
            onClick={() => dispatch({ type: 'select-group', group: chip.group })}
          >
            {chip.label}
          </Chip>
        ))}
      </div>
      <p className="panel__note">묶음은 공시 제목의 낱말로 나눈 것이라 실제 내용과 다를 수 있어요. 원문으로 확인해 주세요.</p>

      {view.total === 0 ? (
        <EmptyState title={emptyTitle(timeline.group)} />
      ) : (
        <ol className="disclosure-timeline__days">
          {view.days.map((day) => (
            <li key={day.date} className="disclosure-timeline__day">
              <h3 className="disclosure-timeline__date">
                <time dateTime={day.date}>{formatDate(day.date)}</time>
              </h3>
              <ul className="disclosure-timeline__items">
                {day.items.map((item) => (
                  <DisclosureRow key={item.rceptNo} corpCode={corpCode} item={item} />
                ))}
              </ul>
            </li>
          ))}
        </ol>
      )}
      {view.remaining > 0 && (
        <div className="disclosure-timeline__more">
          <Button variant="secondary" onClick={() => dispatch({ type: 'show-more' })}>
            더 보기 ({Math.min(view.remaining, TIMELINE_PAGE_SIZE)}건 / 남은 {view.remaining}건)
          </Button>
        </div>
      )}
    </div>
  )
}

function DisclosureRow({ corpCode, item }: { corpCode: string; item: DisclosureItem }) {
  const url = verifiedDartUrl(item.rceptNo, item.dartUrl)
  return (
    <li className="disclosure-timeline__item">
      <Badge tone={item.periodic ? 'accent' : 'neutral'}>{item.groupLabel}</Badge>
      <div className="disclosure-timeline__main">
        {url === null ? (
          <span className="disclosure-timeline__name">
            {item.reportName} <span className="dart-link__help">(원문 링크 확인 안 됨, 접수번호 {item.rceptNo})</span>
          </span>
        ) : (
          <a className="disclosure-timeline__name" href={url} target="_blank" rel="noopener noreferrer">
            {item.reportName} <span aria-hidden="true">↗</span>
            <span className="visually-hidden">(DART 원문 새 창)</span>
          </a>
        )}
        <span className="disclosure-timeline__meta">
          {item.filerName ?? '제출인 없음'} · 접수번호 {item.rceptNo}
        </span>
      </div>
      {item.periodic && (
        <Link className="disclosure-timeline__compare" to={compareWithReportPath(corpCode, item.rceptNo)}>
          이 보고서로 비교하기<span className="visually-hidden"> ({item.reportName})</span>
        </Link>
      )}
    </li>
  )
}

function emptyTitle(group: DisclosureGroup | null): string {
  return group === null ? '이 기간에 낸 공시가 없어요.' : '이 묶음에 해당하는 공시가 없어요.'
}

function fetchedLabel(fetchedAt: string): string {
  return `${formatDate(fetchedAt.slice(0, 10))} ${fetchedAt.slice(11, 16)}`
}

function refreshNotice(list: DisclosureList): string {
  const reason = refreshErrorMessages[list.refreshError ?? ''] ?? 'OpenDART에서 최신 공시를 받지 못했어요'
  const when = list.fetchedAt ? `${fetchedLabel(list.fetchedAt)}에 ` : ''
  return `${reason}. ${when}받아 둔 목록을 보여 줘요.`
}
