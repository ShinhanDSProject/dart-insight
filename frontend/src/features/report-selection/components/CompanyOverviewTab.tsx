import type { ComponentType, MouseEvent } from 'react'
import { cx } from '@/shared/lib/cx'
import { ButtonLink } from '@/shared/ui'
import { useActiveSection } from '../hooks/useActiveSection'
import type { OverviewSectionProps } from '../model/overviewSections'
import { CompanyAskSection } from './CompanyAskSection'
import { CompanyBriefingSection } from './CompanyBriefingSection'
import { CompanyProfileCard } from './CompanyProfileCard'
import { DisclosureSignalsSection } from './DisclosureSignalsSection'
import { DisclosureTimelineSection } from './DisclosureTimelineSection'
import { FinancialTrendSection } from './FinancialTrendSection'
import { KeyFactsSection } from './KeyFactsSection'

interface OverviewSection {
  key: string
  /** 바로 가기 바에 쓰는 짧은 이름 */
  label: string
  Component: ComponentType<OverviewSectionProps>
  /** 넓은 화면에서 놓는 자리. main·side는 한 줄에 나란히, 없으면 전체 폭 */
  place?: 'main' | 'side'
}

/**
 * 기업 개요 탭의 영역을 위에서부터 그리는 순서(FS-45~49, FS-53).
 * 정해 둔 순서: AI 브리핑(FS-49) | 기업 개황(FS-45)을 한 줄에 나란히(#385) → AI에게 묻기(FS-53, #365) → 재무 흐름(FS-46)
 * → 주주·임원·배당(FS-47) → 확인해 볼 공시(FS-55, #411) → 최근 공시(FS-48). 아직 없는 영역은 자리도 보이지 않는다.
 *
 * 영역을 더할 때: OverviewSectionProps를 받는 컴포넌트를 만들고 이 배열의 정해 둔 자리에 한 줄을 더한다.
 * 각 영역은 Panel 하나로 자기 자료·로딩·오류를 맡는다(model/overviewSections.ts).
 * 위쪽 바로 가기 바(#385)가 이 배열의 이름으로 각 영역에 이어지고, 지금 보고 있는 영역을 표시한다.
 */
const sections: readonly OverviewSection[] = [
  { key: 'briefing', label: 'AI 브리핑', Component: CompanyBriefingSection, place: 'main' },
  { key: 'profile', label: '기업 개황', Component: CompanyProfileCard, place: 'side' },
  { key: 'ask', label: 'AI에게 묻기', Component: CompanyAskSection },
  { key: 'financial-trends', label: '재무 흐름', Component: FinancialTrendSection },
  { key: 'key-facts', label: '주주·임원·배당', Component: KeyFactsSection },
  { key: 'disclosure-signals', label: '확인해 볼 공시', Component: DisclosureSignalsSection },
  { key: 'disclosures', label: '최근 공시', Component: DisclosureTimelineSection },
]

const slotId = (key: string) => `overview-${key}`
const SLOT_IDS = sections.map((section) => slotId(section.key))

export function CompanyOverviewTab(props: OverviewSectionProps) {
  const { active, prefer } = useActiveSection(SLOT_IDS)

  function jump(event: MouseEvent<HTMLAnchorElement>, id: string) {
    const target = document.getElementById(id)
    if (!target) return
    // 주소에 #을 남기지 않고 그 영역으로 옮긴 뒤, 키보드 사용자도 이어서 읽도록 그 영역에 초점을 둔다
    event.preventDefault()
    prefer(id)
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
    target.focus({ preventScroll: true })
  }

  return (
    <>
      <nav className="overview-nav" aria-label="기업 개요 바로 가기">
        <ul className="overview-nav__list">
          {sections.map(({ key, label }) => (
            <li key={key}>
              <a
                className="overview-nav__link"
                href={`#${slotId(key)}`}
                aria-current={active === slotId(key) ? 'location' : undefined}
                onClick={(event) => jump(event, slotId(key))}
              >
                {label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <p className="company-overview__actions">
        <ButtonLink variant="secondary" to={`/compare/companies?corps=${encodeURIComponent(props.corpCode)}`}>
          다른 기업과 나란히 보기
        </ButtonLink>
      </p>
      <div className="company-overview">
        {sections.map(({ key, Component, place }) => (
          <div
            key={key}
            id={slotId(key)}
            className={cx('company-overview__slot', place && `company-overview__slot--${place}`)}
            tabIndex={-1}
          >
            <Component {...props} />
          </div>
        ))}
      </div>
    </>
  )
}
