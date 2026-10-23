import { describe, expect, it } from 'vitest'
import {
  hasSearchFilter,
  moreLabel,
  parseTextSearch,
  resultCountLabel,
  searchQueryOf,
  sectionOptions,
} from './textFilter'

describe('parseTextSearch', () => {
  it('앞뒤 공백을 지우고 비었으면 검색하지 않는다', () => {
    expect(parseTextSearch('   ')).toEqual({ kind: 'empty' })
    expect(searchQueryOf('')).toBeNull()
  })

  it('2자보다 짧으면 서버에 보내지 않고 안내한다', () => {
    expect(parseTextSearch(' 가 ')).toEqual({ kind: 'too-short' })
    expect(searchQueryOf('가')).toBeNull()
  })

  it('2자 이상이면 공백을 지운 검색어로 찾는다', () => {
    expect(parseTextSearch('  제재 등 ')).toEqual({ kind: 'ready', q: '제재 등' })
    expect(searchQueryOf('소송')).toBe('소송')
  })

  it('100자보다 길면 100자까지만 보낸다', () => {
    expect(searchQueryOf('가'.repeat(120))).toBe('가'.repeat(100))
  })
})

describe('sectionOptions', () => {
  const sections = [
    { title: 'II. 사업의 내용', count: 1234 },
    { title: 'XI. 그 밖에 투자자 보호를 위하여 필요한 사항', count: 0 },
  ]

  it('전체 섹션을 맨 앞에 두고 섹션마다 건수를 붙인다', () => {
    expect(sectionOptions(sections, null)).toEqual([
      { value: '', label: '전체 섹션' },
      { value: 'II. 사업의 내용', label: 'II. 사업의 내용 (1,234)' },
      { value: 'XI. 그 밖에 투자자 보호를 위하여 필요한 사항', label: 'XI. 그 밖에 투자자 보호를 위하여 필요한 사항 (0)' },
    ])
  })

  it('주소의 섹션이 목록에 없으면 0건으로 붙여 고른 값을 보여 준다', () => {
    expect(sectionOptions(sections, 'IX. 없는 섹션').at(-1)).toEqual({ value: 'IX. 없는 섹션', label: 'IX. 없는 섹션 (0)' })
    expect(sectionOptions(sections, 'II. 사업의 내용')).toHaveLength(3)
  })
})

describe('결과 건수 문구', () => {
  it('섹션이나 검색어 중 하나라도 있으면 거르는 중이다', () => {
    expect(hasSearchFilter({ section: null, q: null })).toBe(false)
    expect(hasSearchFilter({ section: 'II. 사업의 내용', q: null })).toBe(true)
    expect(hasSearchFilter({ section: null, q: '소송' })).toBe(true)
  })

  it('결과 건수와 더 보기의 남은 건수를 보여 준다', () => {
    expect(resultCountLabel(1520)).toBe('1,520건')
    expect(moreLabel(20, 57)).toBe('더 보기 (남은 37건)')
    expect(moreLabel(57, 57)).toBeNull()
  })
})
