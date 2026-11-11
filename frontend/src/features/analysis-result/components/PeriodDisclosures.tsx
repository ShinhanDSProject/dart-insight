import { Link } from 'react-router'
import { match } from 'ts-pattern'
import type { Analysis } from '@/shared/api/analyses'
import { formatDate } from '@/shared/lib/reportLabels'
import { Badge, Button } from '@/shared/ui'
import { usePeriodDisclosures } from '../hooks/usePeriodDisclosures'
import { formatCount } from '../model/overview'
import { periodBreakdownLine, type PeriodDisclosures as PeriodData } from '../model/periodDisclosures'

/**
 * 요약 탭 오른쪽 '이 기간 수시공시 N건'(시안). 두 보고서 사이에 낸 수시공시를 코드가 세어, 많이 낸 제목 3개와 DART 원문 링크를 보인다.
 * 머리 건수는 실적·영업·자금 조달·지배구조만 세고(FS-68 AC3), 아래 한 줄에 기타를 포함한 묶음별 건수와 뺀 지분 변동 수를 보인다.
 * 제목은 그 네 묶음에서 먼저 고르고 모자라면 기타로 채운다. 보조 근거라 재무 변화의 원인으로 단정하지 않는다.
 * 기본은 펼쳐 둔 접고 펼 수 있는(details) 상자이며, 제목 줄을 눌러 접거나 다시 펼칠 수 있다.
 */
export function PeriodDisclosures({ analysis }: { analysis: Analysis }) {
  const { state, reload } = usePeriodDisclosures(analysis)
  const count = state.status === 'success' ? state.data.count : null
  const titleText = count !== null ? `이 기간 수시공시 ${formatCount(count)}건` : '이 기간 수시공시'

  return (
    <section className="section-chart period-disclosures" aria-labelledby="period-disclosures-title">
      <details className="period-disclosures__details" open>
        <summary className="period-disclosures__summary">
          <div className="period-disclosures__head">
            <h3 className="section-chart__title" id="period-disclosures-title">
              {titleText}
            </h3>
            <Badge>보조 근거</Badge>
          </div>
          <span className="period-disclosures__toggle" aria-hidden="true" />
        </summary>
        <div className="period-disclosures__body">
          {match(state)
            .with({ status: 'loading' }, () => (
              <p className="panel__note" role="status">
                불러오는 중…
              </p>
            ))
            .with({ status: 'error' }, () => (
              <p className="panel__note">
                공시 목록을 불러오지 못했어요.{' '}
                <Button variant="link" onClick={reload}>
                  다시 시도
                </Button>
              </p>
            ))
            .with({ status: 'success' }, ({ data }) => <PeriodBody data={data} corpCode={analysis.corpCode} />)
            .exhaustive()}
        </div>
      </details>
    </section>
  )
}

function PeriodBody({ data, corpCode }: { data: PeriodData; corpCode: string }) {
  return (
    <>
      <p className="period-disclosures__breakdown">{periodBreakdownLine(data)}</p>
      {data.titles.length === 0 ? (
        <p className="panel__note">이 기간에 낸 수시공시가 없어요.</p>
      ) : (
        <ul className="period-disclosures__list">
          {data.titles.map((title) => (
            <li key={title.title}>
              <a href={title.dartUrl} target="_blank" rel="noreferrer" className="period-disclosures__title">
                {title.title}
                <span className="visually-hidden">(DART 원문, 새 창)</span>
              </a>
              <span className="period-disclosures__count">
                {title.group === 'OTHER' && '기타 · '}
                {formatCount(title.count)}회
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="period-disclosures__note">
        {formatDate(data.from)} ~ {formatDate(data.to)} 접수
        {data.clipped && ' (최근 1년만 셌어요)'} · {formatCount(data.count)}건은 실적·영업·자금 조달·지배구조만 센 수예요. 정기보고서
        밖의 공시라 원인이라고 단정하지 않아요.
      </p>
      <Link to={`/companies/${encodeURIComponent(corpCode)}?view=overview`} className="section-chart__all">
        기업 개요에서 공시 타임라인 보기
      </Link>
    </>
  )
}
