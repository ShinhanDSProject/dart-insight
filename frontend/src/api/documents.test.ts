import { describe, expect, it } from 'vitest'
import { firstContentSection, type SectionItem } from './documents'

const section = (sectionNo: number, cover: boolean, blockCount: number): SectionItem => ({
  sectionNo,
  parentNo: null,
  depth: 1,
  title: `섹션 ${sectionNo}`,
  cover,
  blockCount,
})

describe('firstContentSection', () => {
  it('표지와 빈 섹션을 건너뛴다', () => {
    expect(firstContentSection([section(1, true, 3), section(2, false, 0), section(3, false, 2)])).toBe(3)
  })

  it('글이 있는 섹션이 없으면 첫 섹션, 목차가 없으면 null', () => {
    expect(firstContentSection([section(1, true, 0)])).toBe(1)
    expect(firstContentSection([])).toBeNull()
  })
})
