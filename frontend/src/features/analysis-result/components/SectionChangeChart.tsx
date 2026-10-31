import type { CSSProperties } from 'react'
import { match } from 'ts-pattern'
import type { TextSectionCount } from '@/shared/api/textChanges'
import type { LoadState } from '@/shared/hooks/asyncState'
import { Button } from '@/shared/ui'
import { formatCount, type TextOverview } from '../model/overview'
import { sectionBars } from '../model/sectionBars'

interface SectionChangeChartProps {
  /** 변화 개요가 이미 불러온 문장 변화 응답(같은 요청의 sections를 쓴다) */
  state: LoadState<TextOverview>
  /** 문장 변화 탭을 그 최상위 섹션(원래 제목)으로 거른다 */
  onOpenSection: (section: string) => void
  /** '섹션 전체 보기': 문장 변화 탭을 거르기 없이 연다 */
  onOpenAll: () => void
}

/** 요약 탭 오른쪽에 보이는 섹션 수(#560) */
const ASIDE_SECTION_LIMIT = 3

/**
 * 요약 탭 오른쪽 '변경이 많은 섹션' 가로 막대(#295, #560). 건수가 많은 섹션 3개를 한 가지 중립색 막대와 건수 글자로 보이고,
 * 나머지는 '섹션 전체 보기'로 문장 탭에서 본다. 행은 버튼이고 누르면 문장 탭이 그 섹션으로 걸러진다. 라이브러리 없이 그린다(ADR-0018).
 * 실패는 바로 위 개요 숫자 자리에서 알리고 다시 시도하므로 여기서는 숨긴다. 문장을 비교하지 못했거나 변경이 없어도 숨긴다.
 */
export function SectionChangeChart({ state, onOpenSection, onOpenAll }: SectionChangeChartProps) {
  return match(state)
    .with({ status: 'loading' }, () => (
      <section className="section-chart" aria-labelledby="section-chart-title">
        <h3 className="section-chart__title" id="section-chart-title">
          변경이 많은 섹션
        </h3>
        <p className="panel__note" role="status">
          불러오는 중…
        </p>
      </section>
    ))
    .with({ status: 'error' }, () => null)
    .with({ status: 'success' }, ({ data }) =>
      match(data)
        .with({ status: 'unavailable' }, () => null)
        .with({ status: 'available' }, (t) => <SectionBarsView sections={t.sections} onOpenSection={onOpenSection} onOpenAll={onOpenAll} />)
        .exhaustive(),
    )
    .exhaustive()
}

interface SectionBarsViewProps {
  sections: TextSectionCount[]
  onOpenSection: (section: string) => void
  onOpenAll: () => void
}

function SectionBarsView({ sections, onOpenSection, onOpenAll }: SectionBarsViewProps) {
  const { bars, restSections } = sectionBars(sections, ASIDE_SECTION_LIMIT)
  if (bars.length === 0) return null

  return (
    <section className="section-chart" aria-labelledby="section-chart-title">
      <h3 className="section-chart__title" id="section-chart-title">
        변경이 많은 섹션
      </h3>
      <ol className="section-chart__rows">
        {bars.map((bar, index) => (
          // --row: 행 순서대로 조금씩 늦게 그려지게 하는 값
          <li key={bar.title} style={{ '--row': index } as CSSProperties}>
            <button
              type="button"
              className="section-chart__row"
              aria-label={`${bar.label}: 문장 변경 ${formatCount(bar.count)}건. 문장 탭에서 보기`}
              onClick={() => onOpenSection(bar.title)}
            >
              <span className="section-chart__name" title={bar.label}>
                {bar.label}
              </span>
              <span className="section-chart__plot">
                <span className="section-chart__bar" style={{ width: `${bar.width}%` }} />
              </span>
              <span className="section-chart__value">{formatCount(bar.count)}건</span>
            </button>
          </li>
        ))}
      </ol>
      <Button variant="link" className="section-chart__all" onClick={onOpenAll}>
        섹션 전체 보기 ({formatCount(bars.length + restSections)}개)
      </Button>
    </section>
  )
}
