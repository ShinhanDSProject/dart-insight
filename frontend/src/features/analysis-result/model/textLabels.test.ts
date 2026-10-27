import { describe, expect, it } from 'vitest'
import {
  firstNotedIds,
  changeTypeHelp,
  changeTypeHelpItems,
  changeTypeLabel,
  changeTypeOptions,
  comparesWords,
  countFor,
  missingSideLabel,
  movedPaths,
  priorityLabel,
  showsNumbersOnlyMark,
  typeFilterLabel,
  typeFilterOptions,
  textStatusNotice,
} from './textLabels'

const counts = { all: 9, added: 2, deleted: 3, modified: 1, numericUpdate: 1, moved: 1, reviewNeeded: 1 }

describe('textLabels', () => {
  it('변경 유형과 건수', () => {
    expect(changeTypeLabel('REVIEW_NEEDED')).toBe('검토 필요')
    expect(countFor(counts, null)).toBe(9)
    expect(countFor(counts, 'DELETED')).toBe(3)
    expect(countFor(counts, 'REVIEW_NEEDED')).toBe(1)
  })

  it('숫자만 바뀜·위치 이동은 따로 이름과 건수가 있고 거르기 칩에 들어간다', () => {
    expect(changeTypeLabel('NUMERIC_UPDATE')).toBe('숫자만 바뀜')
    expect(changeTypeLabel('MOVED')).toBe('위치 이동')
    expect(countFor(counts, 'NUMERIC_UPDATE')).toBe(1)
    expect(countFor(counts, 'MOVED')).toBe(1)
    expect(changeTypeOptions.map((o) => o.value)).toEqual([
      null,
      'ADDED',
      'DELETED',
      'MODIFIED',
      'NUMERIC_UPDATE',
      'MOVED',
      'REVIEW_NEEDED',
    ])
  })

  it('모든 변경 유형에 비어 있지 않은 설명이 있고, 설명 목록은 거르기 칩 순서를 따른다', () => {
    const types = changeTypeOptions.flatMap((o) => (o.value === null ? [] : [o.value]))
    expect(Object.keys(changeTypeHelp).sort()).toEqual([...types].sort())
    expect(types).toHaveLength(6)
    for (const type of types) expect(changeTypeHelp[type].trim()).not.toBe('')
    const items = changeTypeHelpItems()
    expect(items.map((i) => i.type)).toEqual(types)
    expect(items.map((i) => i.label)).toEqual(types.map(changeTypeLabel))
    expect(items.map((i) => i.help)).toEqual(types.map((t) => changeTypeHelp[t]))
  })

  it('숫자만 바뀜 표시는 옛 결과(수정 + numbersOnly)에만 따로 붙인다', () => {
    expect(showsNumbersOnlyMark({ changeType: 'MODIFIED', numbersOnly: true })).toBe(true)
    expect(showsNumbersOnlyMark({ changeType: 'NUMERIC_UPDATE', numbersOnly: true })).toBe(false)
    expect(showsNumbersOnlyMark({ changeType: 'MODIFIED', numbersOnly: false })).toBe(false)
  })

  it('위치 이동은 옮기기 전·후 섹션 경로를 주고, 같은 섹션이면 순서만 바뀐 것으로 본다', () => {
    expect(
      movedPaths({ changeType: 'MOVED', sectionPath: 'II > 2. 주요 제품', previousSectionPath: 'II > 1. 개요' }),
    ).toEqual({ from: 'II > 1. 개요', to: 'II > 2. 주요 제품', sameSection: false })
    expect(movedPaths({ changeType: 'MOVED', sectionPath: 'II > 1. 개요', previousSectionPath: 'II > 1. 개요' })).toEqual({
      from: 'II > 1. 개요',
      to: 'II > 1. 개요',
      sameSection: true,
    })
    expect(movedPaths({ changeType: 'MODIFIED', sectionPath: 'II', previousSectionPath: null })).toBeNull()
    expect(movedPaths({ changeType: 'MOVED', sectionPath: 'II', previousSectionPath: null })).toBeNull()
  })

  it('두 쪽 글이 모두 있는 유형만 낱말 차이를 보여 준다', () => {
    expect(comparesWords('MODIFIED')).toBe(true)
    expect(comparesWords('NUMERIC_UPDATE')).toBe(true)
    expect(comparesWords('MOVED')).toBe(true)
    expect(comparesWords('ADDED')).toBe(false)
    expect(comparesWords('REVIEW_NEEDED')).toBe(false)
  })

  it('우선순위는 확인 순서 문구로만 보여 준다', () => {
    expect(priorityLabel('HIGH')).toBe('우선순위 높음')
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

describe('내용 변경 칩(#304)', () => {
  it('숫자만 바뀜·위치 이동이 있는 분석에서만 전체 바로 뒤에 둔다', () => {
    expect(typeFilterOptions(true).map((o) => o.label)).toEqual([
      '전체',
      '내용 변경',
      '추가',
      '삭제',
      '수정',
      '숫자만 바뀜',
      '위치 이동',
      '검토 필요',
    ])
    expect(typeFilterOptions(true)[1]?.value).toBe('CONTENT')
    expect(typeFilterOptions(false).map((o) => o.value)).not.toContain('CONTENT')
    expect(typeFilterOptions(null).map((o) => o.value)).not.toContain('CONTENT')
  })

  it('건수는 추가·삭제·수정의 합이고 이름은 내용 변경이다', () => {
    expect(countFor(counts, 'CONTENT')).toBe(6)
    expect(typeFilterLabel('CONTENT')).toBe('내용 변경')
    expect(typeFilterLabel('MOVED')).toBe('위치 이동')
  })
})

describe('firstNotedIds(#393)', () => {
  it('삭제·위치 이동 안내는 목록에서 그 종류의 첫 카드에만 붙인다', () => {
    const items = [
      { changeId: 1, changeType: 'MODIFIED' as const },
      { changeId: 2, changeType: 'DELETED' as const },
      { changeId: 3, changeType: 'DELETED' as const },
      { changeId: 4, changeType: 'MOVED' as const },
      { changeId: 5, changeType: 'MOVED' as const },
    ]
    expect([...firstNotedIds(items)].sort()).toEqual([2, 4])
  })

  it('삭제·위치 이동 카드가 없으면 안내를 붙이지 않는다', () => {
    expect(firstNotedIds([{ changeId: 1, changeType: 'ADDED' }]).size).toBe(0)
    expect(firstNotedIds([]).size).toBe(0)
  })
})
