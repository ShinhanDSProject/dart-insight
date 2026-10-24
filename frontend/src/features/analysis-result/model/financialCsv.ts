import type { FinancialChangeItem } from '@/shared/api/results'
import { shortCalcLabel } from './format'

/**
 * 재무 수치 변화 CSV(FS-8 R1·R2). 화면에 불러온 계정을 그대로 옮기고 숫자를 다시 계산하지 않는다.
 * 금액은 원 단위 정수 그대로, 없는 값은 빈 칸(0이 아님), 증감률은 API의 비율을 100배한 값을 소수 둘째 자리까지 적는다.
 * 엑셀에서 한글이 깨지지 않도록 UTF-8 BOM을 앞에 붙이고, 줄은 CRLF로 나눈다(RFC 4180).
 */

export const CSV_HEADER = [
  '재무제표',
  '계정',
  '이전 값',
  '현재 값',
  '증감액',
  '증감률(%)',
  '계산 상태',
  '통화',
  '이전 접수번호',
  '현재 접수번호',
] as const

const BOM = '﻿'
const CRLF = '\r\n'

export interface FinancialCsvInput {
  /** 재무제표 이름(예: 재무상태표) */
  statementLabel: string
  items: FinancialChangeItem[]
  previousRceptNo: string
  currentRceptNo: string
}

/** 쉼표·큰따옴표·줄바꿈이 있으면 큰따옴표로 감싸고 안의 큰따옴표는 두 번 쓴다 */
export function csvCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value
}

/**
 * 글자 칸이 =·+·-·@ 등으로 시작하면 스프레드시트가 수식으로 읽지 않게 앞에 '를 붙인다.
 * 금액·증감률 칸은 음수 부호가 있어야 하므로 이 처리를 하지 않는다.
 */
function textCell(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
}

function amountCell(value: number | null): string {
  return value === null ? '' : String(value)
}

/** 0.153 → '15.3', -0.12345 → '-12.35'. 비율을 표시 형식으로만 바꾼다 */
export function rateCell(rate: number | null): string {
  if (rate === null) return ''
  const percent = Number((rate * 100).toFixed(2))
  return String(percent === 0 ? 0 : percent)
}

/** 계산했으면 '계산됨', 아니면 표에 쓰는 짧은 사유. 모르는 상태는 코드 그대로 둔다 */
export function calcStatusCell(calcStatus: string): string {
  return calcStatus === 'OK' ? '계산됨' : (shortCalcLabel(calcStatus) ?? calcStatus)
}

export function buildFinancialCsv({ statementLabel, items, previousRceptNo, currentRceptNo }: FinancialCsvInput): string {
  const rows = items.map((item) => [
    textCell(statementLabel),
    textCell(item.accountName),
    amountCell(item.previousAmount),
    amountCell(item.currentAmount),
    amountCell(item.changeAmount),
    rateCell(item.changeRate),
    textCell(calcStatusCell(item.calcStatus)),
    textCell(item.currency ?? ''),
    previousRceptNo,
    currentRceptNo,
  ])
  const lines = [[...CSV_HEADER], ...rows].map((row) => row.map(csvCell).join(','))
  return BOM + lines.join(CRLF) + CRLF
}

/** 파일 이름에 쓸 수 없는 글자(\ / : * ? " < > |, 제어 문자)를 _로 바꾸고 앞뒤 공백·마침표를 뺀다 */
function fileNamePart(value: string): string {
  return (
    value
      // eslint-disable-next-line no-control-regex
      .replace(/[\\/:*?"<>|\u0000-\u001f\u007f]/g, '_')
      .replace(/\s+/g, ' ')
      .replace(/^[\s.]+|[\s.]+$/g, '')
  )
}

/** {회사}_{이전 보고서}_{현재 보고서}_{재무제표}.csv */
export function csvFileName(corpName: string, previousReportName: string, currentReportName: string, statementLabel: string): string {
  const parts = [corpName, previousReportName, currentReportName, statementLabel].map(fileNamePart).filter((p) => p !== '')
  return `${parts.join('_') || '재무수치변화'}.csv`
}
