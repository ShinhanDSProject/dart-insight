import { describe, expect, it } from 'vitest'
import type { SourceBlock } from '@/shared/api/documents'
import type { SourcePart } from './sourceParts'
import {
  EMPTY_SOURCE_SEARCH_RESULT,
  findSourceHits,
  highlightSegments,
  initialSourceSearchState,
  parseSourceSearch,
  sourceSearchReducer,
  sourceSearchStatusLabel,
} from './sourceSearch'

function paragraph(blockNo: number, text: string): SourceBlock {
  return { blockNo, evidenceId: `20250814000123#B${blockNo}`, type: 'PARAGRAPH', text, table: null }
}

function tableBlock(blockNo: number, rows: string[][]): SourceBlock {
  return {
    blockNo,
    evidenceId: `20250814000123#B${blockNo}`,
    type: 'TABLE',
    text: '',
    table: rows.map((row, r) =>
      row.map((text) => ({ text, header: r === 0, colspan: 1, rowspan: 1 })),
    ),
  }
}

describe('원문 확인 항목 내 검색(#523)', () => {
  const parts: SourcePart[] = [
    {
      title: '1. 일반적 사항',
      blocks: [paragraph(1, '회사의 일반적 사항을 적어요.')],
    },
    {
      title: '2. 우발부채와 약정사항',
      blocks: [
        paragraph(2, '진행 중인 소송 관련 우발부채와 지급보증 우발부채 내역이에요.'),
        tableBlock(3, [
          ['구분', '기말 금액'],
          ['우발부채 합계', '12,500'],
          ['단기차입금 약정', '8,000'],
        ]),
      ],
    },
  ]

  it('2자 미만 입력은 too-short로 구분하고 2자 이상부터 검색어로 인정한다', () => {
    expect(parseSourceSearch('   ')).toEqual({ status: 'empty' })
    expect(parseSourceSearch(' 우 ')).toEqual({ status: 'too-short' })
    expect(parseSourceSearch(' 우발부채 ')).toEqual({ status: 'ready', query: '우발부채' })
  })

  it('문단과 표 셀에서 일치 건수를 합산하고 정규식 특수문자도 안전하게 강조 조각으로 나눈다', () => {
    const result = findSourceHits(parts, '우발부채')
    expect(result).toEqual({
      totalOccurrences: 3,
      blocks: [
        { partIndex: 1, blockNo: 2, hitCount: 2 },
        { partIndex: 1, blockNo: 3, hitCount: 1 },
      ],
    })

    expect(highlightSegments('우발부채(주1) 및 우발부채', '(주1)')).toEqual([
      { text: '우발부채', hit: false },
      { text: '(주1)', hit: true },
      { text: ' 및 우발부채', hit: false },
    ])
  })

  it('검색어를 입력하면 첫 일치 블록이 든 소제목으로 옮기고 이전·다음으로 순환 이동한다', () => {
    const init = initialSourceSearchState(parts, null)
    expect(init.partIndex).toBe(0)

    const searched = sourceSearchReducer(init, { type: 'set-query', input: '우발부채', parts })
    expect(searched.partIndex).toBe(1)
    expect(searched.activeHitIndex).toBe(0)

    const hits = findSourceHits(parts, '우발부채')
    expect(sourceSearchStatusLabel({ status: 'ready', query: '우발부채' }, hits, searched.activeHitIndex)).toBe(
      '3건 일치 (1 / 2)',
    )

    const next = sourceSearchReducer(searched, { type: 'step-hit', delta: 1, blocks: hits.blocks })
    expect(next.activeHitIndex).toBe(1)
    expect(next.navTarget).toBe('hit')
    expect(sourceSearchStatusLabel({ status: 'ready', query: '우발부채' }, hits, next.activeHitIndex)).toBe(
      '3건 일치 (2 / 2)',
    )

    const wrapped = sourceSearchReducer(next, { type: 'step-hit', delta: 1, blocks: hits.blocks })
    expect(wrapped.activeHitIndex).toBe(0)

    const prev = sourceSearchReducer(wrapped, { type: 'step-hit', delta: -1, blocks: hits.blocks })
    expect(prev.activeHitIndex).toBe(1)

    expect(sourceSearchStatusLabel({ status: 'ready', query: '없는단어' }, EMPTY_SOURCE_SEARCH_RESULT, 0)).toBe(
      '일치하는 내용이 없어요.',
    )
  })
})
