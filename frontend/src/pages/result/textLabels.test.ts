import { describe, expect, it } from 'vitest'
import { changeTypeLabel, countFor, missingSideLabel, priorityLabel, textStatusNotice } from './textLabels'

const counts = { all: 9, added: 2, deleted: 3, modified: 3, reviewNeeded: 1 }

describe('textLabels', () => {
  it('변경 유형과 건수', () => {
    expect(changeTypeLabel('REVIEW_NEEDED')).toBe('검토 필요')
    expect(countFor(counts, null)).toBe(9)
    expect(countFor(counts, 'DELETED')).toBe(3)
    expect(countFor(counts, 'REVIEW_NEEDED')).toBe(1)
  })

  it('우선순위는 확인 순서 문구로만 보여 준다', () => {
    expect(priorityLabel('HIGH')).toBe('중요도 높음')
    expect(priorityLabel('UNRANKED')).toBe('판단 유보')
  })

  it('없는 쪽 글은 사업 종료로 단정하지 않는다', () => {
    expect(missingSideLabel('DELETED', 'current')).toBe('현재 보고서에서 확인되지 않음')
    expect(missingSideLabel('ADDED', 'previous')).toBe('이전 보고서에 없던 내용')
  })

  it('비교하지 못했으면 변경 없음이 아니라 사유를 보여 준다', () => {
    expect(textStatusNotice('COMPLETED', null)).toBeNull()
    expect(textStatusNotice('FAILED', '현재 보고서 원문이 OpenDART에 없어요.')).toBe(
      '문장을 비교하지 못했어요. 현재 보고서 원문이 OpenDART에 없어요.',
    )
    expect(textStatusNotice('PARTIAL', null)).toBe('문장 비교 결과가 완전하지 않을 수 있어요.')
    expect(textStatusNotice(null, null)).toContain('비교하지 않았어요')
  })
})
