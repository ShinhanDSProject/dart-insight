// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SeasonChangeList, SeasonKey } from '@/shared/api/seasonChanges'
import { axeViolations } from '@/test/axe'
import { SeasonChanges } from './SeasonChanges'

// 서버 대신 고른 시즌에 따라 고정된 순위를 돌려주고, 어떤 시즌을 불렀는지 남긴다
const api = vi.hoisted(() => ({ calls: [] as (SeasonKey | null)[], list: null as unknown as SeasonChangeList }))
vi.mock('@/shared/api/seasonChanges', () => ({
  getSeasonChanges: (season: SeasonKey | null) => {
    api.calls.push(season)
    return Promise.resolve(api.list)
  },
}))

afterEach(() => {
  cleanup()
  api.calls = []
})

const ranked: SeasonChangeList = {
  season: { reportType: 'HALF', fiscalYear: 2026, previousFiscalYear: 2025 },
  seasons: [
    { reportType: 'HALF', fiscalYear: 2026 },
    { reportType: 'Q1', fiscalYear: 2026 },
  ],
  computedAt: '2026-08-22T04:12:00',
  scoreVersion: 'season-1',
  candidateCount: 100,
  rankedCount: 94,
  excluded: { noReport: 4, failed: 2 },
  items: [
    {
      rank: 1,
      corpCode: '00126380',
      corpName: '삼성전자',
      stockCode: '005930',
      previousRceptNo: '20250814003156',
      currentRceptNo: '20260814003699',
      changeCount: 147,
      highlight: '사업의 내용 수정 31곳 · 위험관리 문단 12개 추가',
      analysisId: 42,
    },
    {
      rank: 2,
      corpCode: '00164779',
      corpName: 'SK하이닉스',
      stockCode: '000660',
      previousRceptNo: '20250814000001',
      currentRceptNo: '20260814000001',
      changeCount: 122,
      highlight: null,
      analysisId: null,
    },
  ],
}

function renderSection() {
  return render(
    <MemoryRouter>
      <SeasonChanges />
    </MemoryRouter>,
  )
}

describe('SeasonChanges', () => {
  it('순위·한 줄 요약·변경 건수와 비교 기간·빠진 기업·계산 방식을 보이고, 줄은 분석 결과로 간다', async () => {
    api.list = ranked
    const { container } = renderSection()

    const items = await screen.findAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(items[0].textContent).toContain('삼성전자')
    expect(items[0].textContent).toContain('사업의 내용 수정 31곳 · 위험관리 문단 12개 추가')
    expect(items[0].textContent).toContain('문장 변경 147')
    expect(screen.getByRole('link', { name: /1위\s*삼성전자/ }).getAttribute('href')).toBe('/analyses/42')
    // 분석을 요청하지 못한 기업은 기업 화면으로 보낸다
    expect(screen.getByRole('link', { name: /2위\s*SK하이닉스/ }).getAttribute('href')).toBe('/companies/00164779')
    expect(screen.getByText(/2026 반기 vs 2025 반기 · 대표 기업 100곳 대상/)).toBeTruthy()
    expect(screen.getByText('보고서가 아직 없는 4곳, 원문을 비교하지 못한 2곳은 순위에서 뺐어요.')).toBeTruthy()
    expect(screen.getByText(/바뀐 양이지 좋고 나쁨이 아니에요\. 출처: DART/)).toBeTruthy()
    expect(await axeViolations(container)).toBe('')
  })

  it('시즌을 고르면 그 시즌 순위를 다시 부른다', async () => {
    api.list = ranked
    renderSection()
    const picker = await screen.findByRole('combobox', { name: '시즌' })

    fireEvent.change(picker, { target: { value: 'Q1-2026' } })

    await waitFor(() => expect(api.calls).toContainEqual({ reportType: 'Q1', fiscalYear: 2026 }))
    expect(api.calls[0]).toBeNull()
  })

  it('계산한 시즌이 없으면 빈 목록 대신 준비 중 안내를 보인다', async () => {
    api.list = { ...ranked, season: null, seasons: [], items: [], excluded: { noReport: 0, failed: 0 } }
    renderSection()

    expect(await screen.findByText(/이번 시즌 순위를 준비하고 있어요/)).toBeTruthy()
    expect(screen.queryByRole('list')).toBeNull()
  })
})
