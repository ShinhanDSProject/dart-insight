import { afterEach, describe, expect, it, vi } from 'vitest'
import type { FinancialChangeList, StatementSummary } from '@/shared/api/results'
import { incomeChanges } from './useExportBrief'

const getFinancialChanges = vi.hoisted(() => vi.fn())
vi.mock('@/shared/api/results', () => ({ getFinancialChanges }))

function statement(sjDiv: StatementSummary['sjDiv'], total: number): StatementSummary {
  return { sjDiv, label: sjDiv, comparable: true, amountBasis: null, note: null, total, changed: total }
}

function list(sjDiv: FinancialChangeList['sjDiv'], statements: StatementSummary[]): FinancialChangeList {
  return { analysisId: 7, fsDiv: 'CFS', sjDiv, changedOnly: true, sort: 'scale', statements, items: [] } as FinancialChangeList
}

afterEach(() => getFinancialChanges.mockReset())

describe('비교 브리프의 손익 묶음', () => {
  it('손익계산서에 계정이 있으면 그대로 쓴다', async () => {
    const is = list('IS', [statement('IS', 30), statement('CIS', 40)])
    const income = await incomeChanges(7, is)
    expect(income).toMatchObject({ sjDiv: 'IS', label: '손익계산서', changes: is })
    expect(getFinancialChanges).not.toHaveBeenCalled()
  })

  it('손익을 포괄손익계산서에만 둔 회사는 포괄손익계산서를 받아 쓴다', async () => {
    const cis = list('CIS', [statement('IS', 0), statement('CIS', 40)])
    getFinancialChanges.mockResolvedValue(cis)
    const income = await incomeChanges(7, list('IS', [statement('IS', 0), statement('CIS', 40)]))
    expect(getFinancialChanges).toHaveBeenCalledWith(7, 'CIS', true, undefined, 'scale')
    expect(income).toMatchObject({ sjDiv: 'CIS', label: '포괄손익계산서', changes: cis })
  })
})
