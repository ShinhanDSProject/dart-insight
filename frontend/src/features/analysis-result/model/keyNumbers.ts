import { match } from 'ts-pattern'
import type { FinancialChangeItem, SjDiv } from '@/shared/api/results'

/** 재무 수치 탭 맨 위 '핵심 숫자' 다섯 칸(#550). 순서는 화면 순서다 */
export type KeyNumberKey = 'REVENUE' | 'OPERATING_INCOME' | 'NET_INCOME' | 'TOTAL_ASSETS' | 'OPERATING_CASH_FLOW'

export interface KeyNumber {
  key: KeyNumberKey
  /** 칸 이름. 찾은 계정이 있으면 원문 계정명('(손실)'은 뺌), 없으면 기본 이름 */
  label: string
  /** 찾은 계정. 이 분석의 재무제표에서 찾지 못하면 null('자료 없음') */
  item: FinancialChangeItem | null
}

/** 재무제표별로 받은 전체 계정(변경 항목만이 아님). 받지 못한 재무제표는 빈 목록 */
export type StatementItems = Partial<Record<SjDiv, FinancialChangeItem[]>>

/** 핵심 숫자를 찾는 재무제표. 손익은 손익계산서가 없으면(단일 포괄손익계산서) 포괄손익계산서에서 찾는다 */
export const KEY_NUMBER_STATEMENTS: SjDiv[] = ['BS', 'IS', 'CIS', 'CF']

const DEFAULT_LABELS: Record<KeyNumberKey, string> = {
  REVENUE: '매출액',
  OPERATING_INCOME: '영업이익',
  NET_INCOME: '순이익',
  TOTAL_ASSETS: '자산총계',
  OPERATING_CASH_FLOW: '영업활동현금흐름',
}

const KEYS: KeyNumberKey[] = ['REVENUE', 'OPERATING_INCOME', 'NET_INCOME', 'TOTAL_ASSETS', 'OPERATING_CASH_FLOW']

const LOSS_SUFFIX = '(손실)'

/** 계정명 맞추기: 공백과 끝의 '(손실)'을 뺀다(backend KeyAccount와 같은 규칙. 예: '영업이익(손실)' → '영업이익') */
export function normalizeAccountName(name: string): string {
  const compact = name.replace(/\s+/g, '')
  return compact.endsWith(LOSS_SUFFIX) ? compact.slice(0, -LOSS_SUFFIX.length) : compact
}

/** 원문 계정명에서 끝의 '(손실)'만 뺀 표시 이름 */
function displayName(name: string): string {
  const trimmed = name.trim()
  return trimmed.endsWith(LOSS_SUFFIX) ? trimmed.slice(0, -LOSS_SUFFIX.length).trim() : trimmed
}

const NET_INCOME_NAMES = new Set(['당기순이익', '반기순이익', '분기순이익'])

function byName(items: FinancialChangeItem[], test: (normalized: string) => boolean): FinancialChangeItem | null {
  return items.find((item) => item.accountDetail === null && test(normalizeAccountName(item.accountName))) ?? null
}

/**
 * 서버가 크기 맥락(#480)에서 표준계정 ID로 찾은 기준 계정 이름. 같은 재무제표의 계정이 그 이름을 가리키면 그 계정을 쓴다.
 * 계정명이 회사마다 다른 매출액('수익(매출액)', '영업수익' 등)을 이름 목록으로 추측하지 않기 위해서다.
 */
function byScaleBase(items: FinancialChangeItem[], base: 'REVENUE' | 'TOTAL_ASSETS'): FinancialChangeItem | null {
  const name = items.find((item) => item.scale.base === base && item.scale.baseAccountName !== null)?.scale.baseAccountName
  if (name === undefined || name === null) return null
  return items.find((item) => item.accountName === name && item.accountDetail === null) ?? null
}

/** 손익 계정은 손익계산서에서 먼저, 없으면 포괄손익계산서에서 찾는다 */
function inIncome(statements: StatementItems, find: (items: FinancialChangeItem[]) => FinancialChangeItem | null) {
  return find(statements.IS ?? []) ?? find(statements.CIS ?? [])
}

function findItem(key: KeyNumberKey, statements: StatementItems): FinancialChangeItem | null {
  const balance = statements.BS ?? []
  return match(key)
    .with('REVENUE', () =>
      inIncome(statements, (items) => byScaleBase(items, 'REVENUE') ?? byName(items, (n) => n === '매출액')),
    )
    .with('OPERATING_INCOME', () => inIncome(statements, (items) => byName(items, (n) => n === '영업이익')))
    .with('NET_INCOME', () => inIncome(statements, (items) => byName(items, (n) => NET_INCOME_NAMES.has(n))))
    .with('TOTAL_ASSETS', () => byScaleBase(balance, 'TOTAL_ASSETS') ?? byName(balance, (n) => n === '자산총계'))
    .with('OPERATING_CASH_FLOW', () =>
      byName(statements.CF ?? [], (n) => n.startsWith('영업활동') && n.endsWith('현금흐름')),
    )
    .exhaustive()
}

/**
 * 받은 재무제표 계정에서 핵심 숫자 다섯 개를 찾는다. 값은 서버가 준 금액·증감 그대로이고 새로 계산하지 않는다.
 * 찾지 못한 칸은 item이 null이다(0으로 채우지 않음).
 */
export function keyNumbers(statements: StatementItems): KeyNumber[] {
  return KEYS.map((key) => {
    const item = findItem(key, statements)
    return { key, label: item === null ? DEFAULT_LABELS[key] : displayName(item.accountName), item }
  })
}
