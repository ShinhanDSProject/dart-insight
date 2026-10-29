// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/shared/api/client'
import type { CheckpointItem, CompanyCheckpoints } from '@/shared/api/checkpoints'
import { axeViolations } from '@/test/axe'
import { FinancialCheckpointsSection } from './FinancialCheckpointsSection'

const getCompanyCheckpoints = vi.fn<(corpCode: string, signal?: AbortSignal) => Promise<CompanyCheckpoints>>()

vi.mock('@/shared/api/checkpoints', () => ({
  getCompanyCheckpoints: (corpCode: string, signal?: AbortSignal) => getCompanyCheckpoints(corpCode, signal),
}))

const CUR = '20260310000123'
const PREV = '20250311000456'
const url = (rceptNo: string) => `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${rceptNo}`
/** 평가·추천 낱말. 화면 어디에도 나오면 안 된다 */
const JUDGMENT = /좋아요|나빠요|우수|양호|위험|안전|건전|부실|저평가|고평가|매수|매도|추천|목표주가|점수|등급|경고|호재|악재/

const evidence = (rceptNo: string, accountId: string, accountName: string, sjDiv = 'IS', statementName = '손익계산서') => ({
  rceptNo,
  fsDiv: 'CFS' as const,
  sjDiv,
  statementName,
  accountId,
  accountName,
  dartUrl: url(rceptNo),
})

const receivables: CheckpointItem = {
  key: 'RECEIVABLES',
  title: '매출채권',
  status: 'CHECK',
  statusLabel: '확인해 볼 점',
  why: '매출채권은 물건이나 서비스를 팔고 아직 받지 못한 돈이에요.',
  formula: '증가율 = (올해 − 작년) ÷ 작년 × 100, 차이 = 매출채권 증가율 − 매출 증가율',
  threshold: '매출채권 증가율 − 매출 증가율이 10%p 이상이면 확인해 볼 점',
  note: null,
  facts: [
    { label: '매출 (올해)', value: 1_100_000_000_000, unit: 'AMOUNT', currency: 'KRW', reason: null, evidence: evidence(CUR, 'ifrs-full_Revenue', '매출액') },
    { label: '매출 (작년)', value: 1_000_000_000_000, unit: 'AMOUNT', currency: 'KRW', reason: null, evidence: evidence(PREV, 'ifrs-full_Revenue', '매출액') },
    { label: '매출 증가율', value: 10, unit: 'PERCENT', currency: null, reason: null, evidence: null },
    { label: '매출채권 증가율', value: 50, unit: 'PERCENT', currency: null, reason: null, evidence: null },
    { label: '증가율 차이', value: 40, unit: 'PERCENT_POINT', currency: null, reason: null, evidence: null },
  ],
  disclosures: [],
}

const inventories: CheckpointItem = {
  ...receivables,
  key: 'INVENTORIES',
  title: '재고자산',
  status: 'NO_DATA',
  statusLabel: '자료 없음',
  note: '올해 재고자산 값을 찾지 못했어요.',
  threshold: '재고자산 증가율 − 매출 증가율이 10%p 이상이면 확인해 볼 점',
  facts: [{ label: '재고자산 (올해)', value: null, unit: 'AMOUNT', currency: null, reason: 'MISSING', evidence: null }],
}

const funding: CheckpointItem = {
  ...receivables,
  key: 'FUNDING_DISCLOSURES',
  title: '자금 조달 공시',
  status: 'OK',
  statusLabel: '특이사항 없음',
  facts: [{ label: '자금 조달 공시', value: 0, unit: 'COUNT', currency: null, reason: null, evidence: null }],
}

function available(items: CheckpointItem[] = [receivables, inventories, funding]): CompanyCheckpoints {
  return {
    corpCode: '00126380',
    status: 'AVAILABLE',
    reason: null,
    message: null,
    currentReport: { rceptNo: CUR, reportName: '사업보고서 (2025.12)', fiscalYear: 2025, periodEnd: '2025-12-31', dartUrl: url(CUR) },
    previousReport: { rceptNo: PREV, reportName: '사업보고서 (2024.12)', fiscalYear: 2024, periodEnd: '2024-12-31', dartUrl: url(PREV) },
    fsDiv: 'CFS',
    statementStatus: 'AVAILABLE',
    disclosureFrom: '2025-10-29',
    disclosureTo: '2026-10-29',
    items,
  }
}

beforeEach(() => getCompanyCheckpoints.mockReset())
afterEach(cleanup)

describe('재무 체크 포인트', () => {
  it('항목마다 상태·수치·계산식·기준값·근거와 왜 보나를 보이고, 좋고 나쁨을 판단하지 않는다고 알린다', async () => {
    getCompanyCheckpoints.mockResolvedValue(available())
    const { container } = render(<FinancialCheckpointsSection corpCode="00126380" />)

    const card = (await screen.findByRole('heading', { name: '매출채권' })).closest('article')!
    expect(screen.getByText('투자자들이 흔히 확인하는 항목을 규칙으로 계산한 것이에요. 좋고 나쁨을 판단하지 않아요.')).toBeTruthy()
    expect(within(card).getByText('확인해 볼 점')).toBeTruthy()
    expect(within(card).getByText('+10.0%')).toBeTruthy()
    expect(within(card).getByText('+50.0%')).toBeTruthy()
    expect(within(card).getByText('+40.0%p')).toBeTruthy()
    expect(within(card).getByText(/매출채권 증가율 − 매출 증가율이 10%p 이상/)).toBeTruthy()
    expect(within(card).getByText(/증가율 = \(올해 − 작년\)/)).toBeTruthy()
    const source = within(card).getByRole('link', { name: '매출 (올해) 근거 DART 원문 새 창으로 열기' })
    expect(source.getAttribute('href')).toBe(url(CUR))
    expect(within(card).getAllByText(/접수번호 20260310000123/).length).toBeGreaterThan(0)

    const why = within(card).getByText('왜 보나요?')
    fireEvent.click(why)
    expect(within(card).getByText(/아직 받지 못한 돈이에요/)).toBeTruthy()

    expect(container.textContent).not.toMatch(JUDGMENT)
    expect(await axeViolations(container)).toBe('')
  })

  it('확인해 볼 점만 주의 색 배지이고 특이사항 없음·자료 없음은 중립색이다', async () => {
    getCompanyCheckpoints.mockResolvedValue(available())
    render(<FinancialCheckpointsSection corpCode="00126380" />)
    await screen.findByRole('heading', { name: '매출채권' })
    expect(screen.getByText('확인해 볼 점').className).toContain('badge--attention')
    const noData = screen.getAllByText('자료 없음').find((el) => el.classList.contains('badge'))!
    expect(noData.className).not.toContain('badge--')
    expect(screen.getByText('특이사항 없음').className).not.toContain('badge--')
  })

  it('계정을 찾지 못하면 0이 아니라 자료 없음으로 보인다', async () => {
    getCompanyCheckpoints.mockResolvedValue(available())
    render(<FinancialCheckpointsSection corpCode="00126380" />)
    const card = (await screen.findByRole('heading', { name: '재고자산' })).closest('article')!
    expect(within(card).getByText('올해 재고자산 값을 찾지 못했어요.')).toBeTruthy()
    const value = within(card).getByText('재고자산 (올해)').nextElementSibling!
    expect(value.textContent).toBe('자료 없음')
  })

  it('사업보고서가 하나뿐이면 계산할 수 없다고 안내한다', async () => {
    getCompanyCheckpoints.mockResolvedValue({
      ...available([]),
      status: 'NOT_AVAILABLE',
      reason: 'NO_PREVIOUS_REPORT',
      message: '사업연도가 한 해 앞선 사업보고서가 없어 작년과 견주는 재무 체크 포인트를 계산할 수 없어요.',
      previousReport: null,
      fsDiv: null,
      statementStatus: null,
    })
    const { container } = render(<FinancialCheckpointsSection corpCode="00126380" />)
    expect(await screen.findByText('전년 사업보고서가 없어요')).toBeTruthy()
    expect(screen.getByText(/한 해 앞선 사업보고서가 없어/)).toBeTruthy()
    expect(await axeViolations(container)).toBe('')
  })

  it('재무제표를 받지 못하면 위에 알린다', async () => {
    getCompanyCheckpoints.mockResolvedValue({ ...available([inventories]), statementStatus: 'FETCH_FAILED', fsDiv: null })
    render(<FinancialCheckpointsSection corpCode="00126380" />)
    expect(await screen.findByText(/재무제표를 OpenDART에서 받지 못해/)).toBeTruthy()
  })

  it('불러오는 동안 자리를 비워 두고, 실패하면 다시 시도할 수 있다', async () => {
    let reject: (error: unknown) => void = () => {}
    getCompanyCheckpoints.mockReturnValueOnce(new Promise((_, r) => (reject = r)))
    const { container } = render(<FinancialCheckpointsSection corpCode="00126380" />)
    expect(container.querySelector('.skeleton')?.getAttribute('aria-busy')).toBe('true')
    expect(await axeViolations(container)).toBe('')

    reject(new ApiError(502, { code: 'DART_REQUEST_FAILED', message: 'x', traceId: 't-1', errors: [] }))
    expect(await screen.findByText('OpenDART에서 보고서 목록을 받지 못했어요. 잠시 뒤 다시 시도해 주세요.')).toBeTruthy()
    getCompanyCheckpoints.mockResolvedValueOnce(available())
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
    expect(await screen.findByRole('heading', { name: '매출채권' })).toBeTruthy()
  })
})
