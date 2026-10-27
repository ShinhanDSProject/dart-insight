import { describe, expect, it } from 'vitest'
import type { SourceBlock } from '@/shared/api/documents'
import { PART_MIN_BLOCKS, partIndexOf, splitParts } from './sourceParts'

let seq = 0
function para(text: string): SourceBlock {
  seq += 1
  return { blockNo: seq, evidenceId: `R#B${seq}`, type: 'PARAGRAPH', text, table: null }
}
function filler(n: number): SourceBlock[] {
  return Array.from({ length: n }, (_, i) => para(`본문 문단 ${i}이에요.`))
}

describe('splitParts(#396)', () => {
  it('1부터 이어지는 번호 소제목으로 긴 항목을 나누고, 소제목 앞 블록은 처음 부분으로 둔다', () => {
    const blocks = [
      para('연결재무제표 주석'),
      para('1. 일반적 사항 (연결)'),
      ...filler(15),
      para('2. 중요한 회계처리방침 (연결)'),
      ...filler(15),
      para('3. 중요한 회계추정 및 가정 (연결)'),
      ...filler(15),
    ]
    const parts = splitParts(blocks)
    expect(parts.map((p) => p.title)).toEqual([
      '처음 부분',
      '1. 일반적 사항 (연결)',
      '2. 중요한 회계처리방침 (연결)',
      '3. 중요한 회계추정 및 가정 (연결)',
    ])
    expect(parts.reduce((n, p) => n + p.blocks.length, 0)).toBe(blocks.length)
    expect(parts[1].blocks).toHaveLength(16)
  })

  it('번호가 건너뛰거나 되돌아가는 본문 안 목록과 문장으로 끝나는 문단은 소제목으로 보지 않는다', () => {
    const blocks = [
      para('1. 일반적 사항'),
      ...filler(15),
      para('1. 이 문단은 목록이에요'),
      para('5. 건너뛴 번호'),
      para('2. 회계정책'),
      ...filler(15),
      para('3. 다음 기간에 적용할 기준서는 아래와 같습니다.'),
      para('3. 추정'),
      ...filler(10),
    ]
    expect(splitParts(blocks).map((p) => p.title)).toEqual(['1. 일반적 사항', '2. 회계정책', '3. 추정'])
  })

  it('짧은 항목이나 소제목이 적은 항목은 나누지 않는다', () => {
    const short = [para('1. 가'), para('2. 나'), para('3. 다')]
    expect(splitParts(short)).toEqual([{ title: '', blocks: short }])
    const few = [para('1. 가'), ...filler(PART_MIN_BLOCKS), para('2. 나')]
    expect(splitParts(few)).toHaveLength(1)
  })

  it('근거 블록이 든 조각을 찾고, 없으면 첫 조각으로 둔다', () => {
    const blocks = [para('1. 가'), ...filler(20), para('2. 나'), ...filler(20), para('3. 다'), ...filler(5)]
    const parts = splitParts(blocks)
    const target = parts[2].blocks[3].blockNo
    expect(partIndexOf(parts, target)).toBe(2)
    expect(partIndexOf(parts, null)).toBe(0)
    expect(partIndexOf(parts, -1)).toBe(0)
  })
})
