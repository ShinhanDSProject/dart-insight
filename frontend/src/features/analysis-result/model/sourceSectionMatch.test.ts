import { describe, expect, it } from 'vitest'
import type { SectionItem } from '@/shared/api/documents'
import {
  buildSectionOrigin,
  initialSourceSectionMatchState,
  matchOutlineSection,
  sourceSectionMatchReducer,
} from './sourceSectionMatch'

function item(sectionNo: number, depth: number, title: string, parentNo: number | null = null, blockCount = 2): SectionItem {
  return { sectionNo, parentNo, depth, title, cover: false, blockCount }
}

describe('원문 확인 반대편 보고서 목차 자동 매칭(#523)', () => {
  const currentOutline: SectionItem[] = [
    item(1, 1, 'I. 회사의 개요'),
    item(2, 1, 'III. 재무에 관한 사항'),
    item(3, 2, '1. 요약재무정보', 2),
    item(4, 2, '3. 연결재무제표 주석', 2),
    item(5, 1, 'IV. 이사의 경영진단 및 분석의견'),
  ]

  it('같은 계층 경로의 목차가 반대편 보고서에 다른 sectionNo로 있어도 정확히 찾는다', () => {
    const origin = buildSectionOrigin(currentOutline, 4)!
    expect(origin.label).toBe('III. 재무에 관한 사항 > 3. 연결재무제표 주석')

    const previousOutline: SectionItem[] = [
      { sectionNo: 1, parentNo: null, depth: 1, title: '(목차 밖 본문)', cover: true, blockCount: 1 },
      item(10, 1, 'I. 회사의 개요'),
      item(20, 1, 'III. 재무에 관한 사항'),
      item(21, 2, '1. 요약재무정보', 20),
      item(25, 2, '3. 연결재무제표 주석', 20),
    ]
    expect(matchOutlineSection(previousOutline, origin)).toBe(25)
  })

  it('유니코드 로마 숫자나 절 번호가 밀린 하위 목차도 핵심 제목 경로로 짝짓는다', () => {
    const origin = buildSectionOrigin(currentOutline, 4)!
    const previousOutline: SectionItem[] = [
      item(1, 1, 'Ⅲ. 재무에 관한 사항'),
      item(2, 2, '4. 연결재무제표 주석', 1),
    ]
    expect(matchOutlineSection(previousOutline, origin)).toBe(2)
  })

  it('같은 대목차 아래 깊이가 달라졌어도 말단 제목이 유일하면 찾고 모호하면 찾지 않는다', () => {
    const origin = buildSectionOrigin(currentOutline, 4)!
    const uniqueReorganized: SectionItem[] = [
      item(1, 1, 'III. 재무에 관한 사항'),
      item(2, 2, '가. 연결재무제표', 1),
      item(3, 3, '(1) 연결재무제표 주석', 2),
    ]
    expect(matchOutlineSection(uniqueReorganized, origin)).toBe(3)

    const ambiguousReorganized: SectionItem[] = [
      item(1, 1, 'III. 재무에 관한 사항'),
      item(2, 2, '가. 연결재무제표', 1),
      item(3, 3, '(1) 연결재무제표 주석', 2),
      item(4, 3, '(2) 연결재무제표 주석', 2),
    ]
    expect(matchOutlineSection(ambiguousReorganized, origin)).toBeNull()
  })

  it('분기보고서처럼 해당 항목이 없는 보고서에서는 null을 돌려준다', () => {
    const origin = buildSectionOrigin(currentOutline, 5)!
    const quarterlyOutline: SectionItem[] = [
      item(1, 1, 'I. 회사의 개요'),
      item(2, 1, 'III. 재무에 관한 사항'),
    ]
    expect(matchOutlineSection(quarterlyOutline, origin)).toBeNull()
  })

  it('전환 상태 리듀서가 대기·성공·미일치 안내·해제를 순서대로 전이한다', () => {
    const origin = buildSectionOrigin(currentOutline, 5)!
    const pending = sourceSectionMatchReducer(initialSourceSectionMatchState, {
      type: 'request-match',
      targetSide: 'previous',
      origin,
    })
    expect(pending).toEqual({ status: 'pending', targetSide: 'previous', origin })

    const unmatched = sourceSectionMatchReducer(pending, {
      type: 'resolve-match',
      side: 'previous',
      matched: false,
      label: origin.label,
    })
    expect(unmatched).toEqual({
      status: 'unmatched',
      side: 'previous',
      label: 'IV. 이사의 경영진단 및 분석의견',
    })

    const cleared = sourceSectionMatchReducer(unmatched, { type: 'clear-match' })
    expect(cleared).toEqual({ status: 'idle' })

    const matched = sourceSectionMatchReducer(pending, {
      type: 'resolve-match',
      side: 'previous',
      matched: true,
      label: origin.label,
    })
    expect(matched).toEqual({ status: 'idle' })
  })
})
