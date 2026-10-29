import type { LensCount, ReviewItem, SummaryItem, SummaryLens } from '@/shared/api/summary'

/** 요약을 관점별로 묶어 볼지(기본), 재무·문장 두 묶음 목록으로 볼지 */
export type SummaryView = 'lens' | 'list'

export const summaryLenses: SummaryLens[] = ['PROFITABILITY', 'GROWTH', 'STABILITY', 'CASH_FLOW', 'SHAREHOLDER', 'RISK', 'OTHER']

/**
 * 관점 제목 옆에 두는, 투자자들이 흔히 묻는 질문(일반 설명, FS-64). 이 회사에 대한 답이나 판단이 아니다.
 * 기타는 주제가 정해지지 않아 질문을 두지 않는다.
 */
export const LENS_QUESTIONS: Record<SummaryLens, string | null> = {
  PROFITABILITY: '매출이 늘 때 이익도 따라 늘었을까요?',
  GROWTH: '외형이 커졌을까요?',
  STABILITY: '빚과 자본의 균형이 바뀌었을까요?',
  CASH_FLOW: '이익이 현금으로 들어왔을까요?',
  SHAREHOLDER: '배당·자기주식에 변화가 있을까요?',
  RISK: '회사가 밝힌 위험이 바뀌었을까요?',
  OTHER: null,
}

/** 질문 앞에 붙여, 이 회사에 대한 판단이 아니라 흔히 묻는 질문임을 밝힌다 */
export const LENS_QUESTION_LEAD = '흔히 묻는 질문'

export const LENS_NOTE = '관점은 재무제표 구분·계정 이름과 공시 목차로 코드가 나눈 것이에요. 좋고 나쁨을 판단하지 않아요.'

/** 주소 값을 관점으로 읽는다. 모르는 값이면 null(전체) */
export function parseSummaryLens(value: string | null): SummaryLens | null {
  return summaryLenses.includes(value as SummaryLens) ? (value as SummaryLens) : null
}

/** 건수가 있는 관점만(0건 관점의 거르기는 그리지 않는다) */
export function visibleLensCounts(counts: LensCount[]): LensCount[] {
  return counts.filter((c) => c.count > 0)
}

/**
 * 고른 관점이 건수에 없으면(0건이거나 모르는 값) 전체로 본다. 주소에 남은 값이 없는 거르기를 가리키지 않게 한다.
 */
export function effectiveLens(lens: SummaryLens | null, counts: LensCount[]): SummaryLens | null {
  if (lens === null) return null
  return visibleLensCounts(counts).some((c) => c.lens === lens) ? lens : null
}

/** 고른 관점의 줄만. null이면 모두 */
export function filterByLens<T extends SummaryItem | ReviewItem>(items: T[], lens: SummaryLens | null): T[] {
  return lens === null ? items : items.filter((i) => i.lens === lens)
}

export interface LensGroup {
  lens: SummaryLens
  label: string
  question: string | null
  items: SummaryItem[]
}

/** 관점 순서로 묶는다. 줄이 없는 관점은 뺀다. 같은 관점 안에서는 받은 순서(재무 수치 → 문장 변화)다 */
export function groupByLens(items: SummaryItem[]): LensGroup[] {
  return summaryLenses
    .map((lens) => ({ lens, items: items.filter((i) => i.lens === lens) }))
    .filter((g) => g.items.length > 0)
    .map((g) => ({ ...g, label: g.items[0].lensLabel, question: LENS_QUESTIONS[g.lens] }))
}
