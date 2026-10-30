// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { axeViolations } from '@/test/axe'
import { BrandLogo } from './BrandLogo'
import { ProgressBar } from './ProgressBar'
import { ReportCard, ReportCardPair } from './ReportCard'

afterEach(cleanup)

const report = {
  reportName: '반기보고서 (2026.06)',
  fiscalYear: 2026,
  periodEnd: '2026-06-30',
  receivedAt: '2026-08-14',
  correction: 'CORRECTED' as const,
}

describe('보고서 카드(#549)', () => {
  it('이전은 회색 배지 기본 카드, 현재는 보라 배지 옅은 바탕 카드로 이름·기간·제출일·정정 여부를 보인다', async () => {
    const { container } = render(
      <ReportCardPair>
        <ReportCard side="previous" report={null} emptyText="비교 기준에 맞는 이전 보고서가 없어요." />
        <ReportCard side="current" report={report} />
      </ReportCardPair>,
    )
    const previous = screen.getByRole('region', { name: '이전 보고서' })
    expect(previous.className).toBe('card report-card')
    expect(within(previous).getByText('비교 기준에 맞는 이전 보고서가 없어요.')).toBeTruthy()

    const current = screen.getByRole('region', { name: '현재 보고서' })
    expect(current.className).toContain('card--subtle')
    expect(within(current).getByText('현재 보고서').className).toContain('badge--accent')
    expect(within(current).getByText('반기보고서 (2026.06)')).toBeTruthy()
    expect(within(current).getByText('2026.01.01 ~ 06.30 · 제출 2026.08.14')).toBeTruthy()
    expect(within(current).getByText('정정 있음 · 최종본')).toBeTruthy()
    expect(await axeViolations(container)).toBe('')
  })
})

describe('진행 막대(#549)', () => {
  it('0~1 값을 백분율로 알리고 범위 밖 값은 잘라 쓴다', () => {
    render(
      <>
        <ProgressBar value={0.375} label="분석 진행률" />
        <ProgressBar value={1.4} label="넘친 값" />
      </>,
    )
    expect(screen.getByRole('progressbar', { name: '분석 진행률' }).getAttribute('aria-valuenow')).toBe('38')
    expect(screen.getByRole('progressbar', { name: '넘친 값' }).getAttribute('aria-valuenow')).toBe('100')
  })
})

describe('로고(#549)', () => {
  it('마크는 숨기고 글자만 읽힌다', () => {
    const { container } = render(<BrandLogo size="lg" />)
    expect(container.textContent).toBe('DART Insight')
    expect(container.querySelector('.brand-logo--lg')).not.toBeNull()
    expect(container.querySelector('.brand-logo__mark')?.getAttribute('aria-hidden')).toBe('true')
  })
})
