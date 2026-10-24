// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it } from 'vitest'
import { axeViolations } from '@/test/axe'
import { OnboardingGuide } from './OnboardingGuide'
import { RecentAnalyses } from './RecentAnalyses'

const noop = () => {}

afterEach(cleanup)

describe('검색 화면 조각 접근성(axe)', () => {
  it('처음 쓰는 사용자 안내에 위반이 없다', async () => {
    const { container } = render(
      <MemoryRouter>
        <OnboardingGuide onDismiss={noop} />
      </MemoryRouter>,
    )
    expect(await axeViolations(container)).toBe('')
  })

  it('최근 본 분석 목록에 위반이 없다', async () => {
    const items = [1, 2].map((analysisId) => ({
      analysisId,
      corpName: analysisId === 1 ? '삼성전자' : 'SK하이닉스',
      previousReportName: '반기보고서 (2024.06)',
      currentReportName: '반기보고서 (2025.06)',
      basisLabel: '전년 동기',
      viewedAt: '2025-10-20T10:00:00+09:00',
    }))
    const { container } = render(
      <MemoryRouter>
        <RecentAnalyses items={items} onRemove={noop} onClear={noop} />
      </MemoryRouter>,
    )
    expect(await axeViolations(container)).toBe('')
  })
})
