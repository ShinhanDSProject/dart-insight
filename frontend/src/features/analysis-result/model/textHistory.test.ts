import { describe, expect, it } from 'vitest'
import type { TextHistoryEntry } from '@/shared/api/textChanges'
import { historyView } from './textHistory'

function entry(status: TextHistoryEntry['status'], change: TextHistoryEntry['change'] = null): TextHistoryEntry {
  return {
    report: { rceptNo: '20250814000001', reportName: '반기보고서 (2025.06)', reportType: 'HALF', periodEnd: '2025-06-30' },
    status,
    text: status === 'PRESENT' ? '당사는 메모리를 만듭니다.' : null,
    sectionPath: null,
    evidenceId: null,
    change,
  }
}

describe('historyView', () => {
  it('글이 있고 바뀐 변경이 있으면 변경 유형을 표시한다', () => {
    expect(historyView(entry('PRESENT', { analysisId: 1, changeId: 2, changeType: 'MODIFIED' }))).toEqual({
      label: '수정',
      tone: 'accent',
      note: null,
    })
  })

  it('글이 있고 바뀌지 않았으면 그대로라고 표시한다', () => {
    expect(historyView(entry('PRESENT')).label).toBe('그대로')
  })

  it('삭제된 뒤의 보고서는 삭제와 글이 없다는 설명을 함께 보여 준다', () => {
    const view = historyView(entry('ABSENT', { analysisId: 1, changeId: 2, changeType: 'DELETED' }))
    expect(view.label).toBe('삭제')
    expect(view.note).toBe('이 보고서에는 이 글이 없어요.')
  })

  it('분석하지 않은 기간과 검토 필요는 변경 없음처럼 보이지 않게 주의 표시를 한다', () => {
    expect(historyView(entry('NOT_ANALYZED'))).toMatchObject({ label: '분석 안 됨', tone: 'attention' })
    expect(historyView(entry('REVIEW_NEEDED'))).toMatchObject({ label: '검토 필요', tone: 'attention' })
  })
})
