import { match } from 'ts-pattern'
import type { CompanyAnalysisItem } from '@/shared/api/analyses'
import type { CheckpointKey, CheckpointStatus } from '@/shared/api/checkpoints'

export interface ActionLink {
  to: string
  label: string
}

/**
 * 전년·당해 접수번호 쌍에 맞는 완료된 분석을 찾는다.
 * 같은 쌍이면 전년 동기(YOY) 기준을 우선하고, 없으면 첫 일치 항목을 돌려준다.
 */
export function findMatchingAnalysis(
  completedAnalyses: readonly CompanyAnalysisItem[],
  previousRceptNo: string | null | undefined,
  currentRceptNo: string | null | undefined,
): CompanyAnalysisItem | null {
  if (!previousRceptNo || !currentRceptNo) return null
  const matches = completedAnalyses.filter(
    (item) => item.previous.rceptNo === previousRceptNo && item.current.rceptNo === currentRceptNo,
  )
  if (matches.length === 0) return null
  return matches.find((item) => item.basis === 'YOY') ?? matches[0]
}

/** 두 보고서의 비교 조건 확인 주소 */
export function compareConditionPath(corpCode: string, previousRceptNo: string, currentRceptNo: string): string {
  return `/companies/${encodeURIComponent(corpCode)}/compare?current=${encodeURIComponent(currentRceptNo)}&previous=${encodeURIComponent(previousRceptNo)}&basis=YOY`
}

/**
 * 체크 포인트 항목별 맞춤 분석 딥링크(AC2).
 * - 현금흐름: 재무제표 탭 현금흐름표(CF)
 * - 매출채권/재고자산/부채비율/차입금: 재무제표 탭 재무상태표(BS) 검색어
 * - 자금조달/감사의견: 문장 탭 위험 필터(trisk=1)
 */
export function checkpointAnalysisLink(analysisId: number, key: CheckpointKey): ActionLink {
  return match(key)
    .with('EARNINGS_QUALITY', () => ({
      to: `/analyses/${analysisId}?tab=financial&sj=CF`,
      label: '현금흐름 수치 변화 보기',
    }))
    .with('RECEIVABLES', () => ({
      to: `/analyses/${analysisId}?tab=financial&sj=BS&q=${encodeURIComponent('매출채권')}`,
      label: '매출채권 수치 변화 보기',
    }))
    .with('INVENTORIES', () => ({
      to: `/analyses/${analysisId}?tab=financial&sj=BS&q=${encodeURIComponent('재고자산')}`,
      label: '재고자산 수치 변화 보기',
    }))
    .with('DEBT_RATIO', () => ({
      to: `/analyses/${analysisId}?tab=financial&sj=BS&q=${encodeURIComponent('부채')}`,
      label: '부채·자본 수치 변화 보기',
    }))
    .with('SHORT_TERM_BORROWINGS', () => ({
      to: `/analyses/${analysisId}?tab=financial&sj=BS&q=${encodeURIComponent('차입금')}`,
      label: '차입금 수치 변화 보기',
    }))
    .with('FUNDING_DISCLOSURES', () => ({
      to: `/analyses/${analysisId}?tab=text&trisk=1`,
      label: '자금 조달 관련 문장 변화 보기',
    }))
    .with('AUDIT_OPINION', () => ({
      to: `/analyses/${analysisId}?tab=text&trisk=1`,
      label: '감사의견 관련 문장 변화 보기',
    }))
    .exhaustive()
}

/**
 * 체크 포인트 카드 액션 링크.
 * 완료된 분석이 있으면 해당 항목 딥링크를, 없으면 CHECK(확인해 볼 점) 항목에 한해 비교 조건 확인 링크를 제공한다.
 */
export function checkpointCardAction(
  corpCode: string,
  previousRceptNo: string,
  currentRceptNo: string,
  analysisId: number | null,
  key: CheckpointKey,
  status: CheckpointStatus,
): ActionLink | null {
  if (analysisId !== null) {
    return checkpointAnalysisLink(analysisId, key)
  }
  if (status === 'CHECK') {
    return {
      to: compareConditionPath(corpCode, previousRceptNo, currentRceptNo),
      label: '이 두 사업보고서 비교하기',
    }
  }
  return null
}

/**
 * 재무 체크 포인트 전체 상단 액션 링크.
 * 완료 분석이 있으면 분석 결과 전체 보기, 없으면 두 보고서 비교하기.
 */
export function overviewPairAction(
  corpCode: string,
  previousRceptNo: string,
  currentRceptNo: string,
  analysisId: number | null,
): ActionLink {
  if (analysisId !== null) {
    return {
      to: `/analyses/${analysisId}`,
      label: '이 두 사업보고서 분석 보기',
    }
  }
  return {
    to: compareConditionPath(corpCode, previousRceptNo, currentRceptNo),
    label: '이 두 사업보고서 비교하기',
  }
}

/**
 * '작년 계획, 올해는' 섹션 액션 링크.
 * 완료 분석이 있으면 문장 변화 전체 탭(?tab=text), 없으면 두 보고서 비교하기.
 */
export function planFollowupPairAction(
  corpCode: string,
  previousRceptNo: string,
  currentRceptNo: string,
  analysisId: number | null,
): ActionLink {
  if (analysisId !== null) {
    return {
      to: `/analyses/${analysisId}?tab=text`,
      label: '두 사업보고서 문장 변화 전체 보기',
    }
  }
  return {
    to: compareConditionPath(corpCode, previousRceptNo, currentRceptNo),
    label: '이 두 사업보고서 비교하기',
  }
}
