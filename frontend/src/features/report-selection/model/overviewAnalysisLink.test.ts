import { describe, expect, it } from 'vitest'
import type { CompanyAnalysisItem } from '@/shared/api/analyses'
import {
  checkpointAnalysisLink,
  checkpointCardAction,
  compareConditionPath,
  findMatchingAnalysis,
  overviewPairAction,
  planFollowupPairAction,
} from './overviewAnalysisLink'

const item = (
  analysisId: number,
  prevRcept: string,
  curRcept: string,
  basis: 'YOY' | 'PREV' = 'YOY',
): CompanyAnalysisItem => ({
  analysisId,
  basis,
  previous: { rceptNo: prevRcept, reportName: '작년 보고서', periodEnd: '2024-12-31' },
  current: { rceptNo: curRcept, reportName: '올해 보고서', periodEnd: '2025-12-31' },
  completedAt: '2026-03-20T10:00:00',
})

describe('overviewAnalysisLink - findMatchingAnalysis', () => {
  it('접수번호가 없으면 null을 돌려준다', () => {
    expect(findMatchingAnalysis([], null, '20260310000001')).toBeNull()
    expect(findMatchingAnalysis([], '20250310000001', null)).toBeNull()
    expect(findMatchingAnalysis([], undefined, undefined)).toBeNull()
  })

  it('일치하는 완료 분석 중 YOY 기준을 우선 매칭한다', () => {
    const list = [
      item(101, 'PREV_1', 'CUR_1', 'PREV'),
      item(102, 'PREV_1', 'CUR_1', 'YOY'),
      item(103, 'OTHER', 'CUR_1', 'YOY'),
    ]
    const matched = findMatchingAnalysis(list, 'PREV_1', 'CUR_1')
    expect(matched?.analysisId).toBe(102)
  })

  it('YOY가 없으면 첫 번째 일치 항목을 돌려준다', () => {
    const list = [item(101, 'PREV_1', 'CUR_1', 'PREV')]
    const matched = findMatchingAnalysis(list, 'PREV_1', 'CUR_1')
    expect(matched?.analysisId).toBe(101)
  })

  it('일치하는 항목이 없으면 null을 돌려준다', () => {
    const list = [item(101, 'PREV_1', 'CUR_1', 'YOY')]
    expect(findMatchingAnalysis(list, 'PREV_2', 'CUR_1')).toBeNull()
  })
})

describe('overviewAnalysisLink - compareConditionPath', () => {
  it('비교 조건 확인 주소를 올바른 쿼리스트링으로 생성한다', () => {
    const path = compareConditionPath('00126380', '20250311000456', '20260310000123')
    expect(path).toBe('/companies/00126380/compare?current=20260310000123&previous=20250311000456&basis=YOY')
  })
})

describe('overviewAnalysisLink - checkpointAnalysisLink', () => {
  it('체크 포인트 항목별로 적절한 탭과 쿼리스트링 딥링크를 생성한다', () => {
    expect(checkpointAnalysisLink(42, 'EARNINGS_QUALITY')).toEqual({
      to: '/analyses/42?tab=financial&sj=CF',
      label: '현금흐름 수치 변화 보기',
    })
    expect(checkpointAnalysisLink(42, 'RECEIVABLES')).toEqual({
      to: `/analyses/42?tab=financial&sj=BS&q=${encodeURIComponent('매출채권')}`,
      label: '매출채권 수치 변화 보기',
    })
    expect(checkpointAnalysisLink(42, 'INVENTORIES')).toEqual({
      to: `/analyses/42?tab=financial&sj=BS&q=${encodeURIComponent('재고자산')}`,
      label: '재고자산 수치 변화 보기',
    })
    expect(checkpointAnalysisLink(42, 'DEBT_RATIO')).toEqual({
      to: `/analyses/42?tab=financial&sj=BS&q=${encodeURIComponent('부채')}`,
      label: '부채·자본 수치 변화 보기',
    })
    expect(checkpointAnalysisLink(42, 'SHORT_TERM_BORROWINGS')).toEqual({
      to: `/analyses/42?tab=financial&sj=BS&q=${encodeURIComponent('차입금')}`,
      label: '차입금 수치 변화 보기',
    })
    expect(checkpointAnalysisLink(42, 'FUNDING_DISCLOSURES')).toEqual({
      to: '/analyses/42?tab=text&trisk=1',
      label: '자금 조달 관련 문장 변화 보기',
    })
    expect(checkpointAnalysisLink(42, 'AUDIT_OPINION')).toEqual({
      to: '/analyses/42?tab=text&trisk=1',
      label: '감사의견 관련 문장 변화 보기',
    })
  })
})

describe('overviewAnalysisLink - checkpointCardAction', () => {
  it('완료 분석이 있으면 항목별 딥링크를 돌려준다', () => {
    const action = checkpointCardAction('00126380', 'PREV', 'CUR', 42, 'RECEIVABLES', 'OK')
    expect(action?.to).toContain('/analyses/42?tab=financial&sj=BS&q=')
    expect(action?.label).toBe('매출채권 수치 변화 보기')
  })

  it('완료 분석이 없고 CHECK(확인해 볼 점) 상태이면 비교 조건 확인 링크를 돌려준다', () => {
    const action = checkpointCardAction('00126380', 'PREV', 'CUR', null, 'RECEIVABLES', 'CHECK')
    expect(action?.to).toBe('/companies/00126380/compare?current=CUR&previous=PREV&basis=YOY')
    expect(action?.label).toBe('이 두 사업보고서 비교하기')
  })

  it('완료 분석이 없고 OK나 NO_DATA 상태이면 링크를 돌려주지 않는다(null)', () => {
    expect(checkpointCardAction('00126380', 'PREV', 'CUR', null, 'RECEIVABLES', 'OK')).toBeNull()
    expect(checkpointCardAction('00126380', 'PREV', 'CUR', null, 'RECEIVABLES', 'NO_DATA')).toBeNull()
  })
})

describe('overviewAnalysisLink - overviewPairAction & planFollowupPairAction', () => {
  it('체크 포인트 전체 상단 액션: 완료 분석이 있으면 분석 결과, 없으면 비교하기', () => {
    expect(overviewPairAction('00126380', 'PREV', 'CUR', 42)).toEqual({
      to: '/analyses/42',
      label: '이 두 사업보고서 분석 보기',
    })
    expect(overviewPairAction('00126380', 'PREV', 'CUR', null)).toEqual({
      to: '/companies/00126380/compare?current=CUR&previous=PREV&basis=YOY',
      label: '이 두 사업보고서 비교하기',
    })
  })

  it('작년 계획 대조 액션: 완료 분석이 있으면 문장 탭(?tab=text), 없으면 비교하기', () => {
    expect(planFollowupPairAction('00126380', 'PREV', 'CUR', 42)).toEqual({
      to: '/analyses/42?tab=text',
      label: '두 사업보고서 문장 변화 전체 보기',
    })
    expect(planFollowupPairAction('00126380', 'PREV', 'CUR', null)).toEqual({
      to: '/companies/00126380/compare?current=CUR&previous=PREV&basis=YOY',
      label: '이 두 사업보고서 비교하기',
    })
  })
})
