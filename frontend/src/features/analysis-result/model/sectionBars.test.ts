import { describe, expect, it } from 'vitest'
import { sectionBars } from './sectionBars'

const section = (title: string, count: number) => ({ title, count })

describe('섹션별 문장 변경 막대', () => {
  it('건수가 많은 순으로 놓고 같으면 문서 순서를 지킨다', () => {
    const result = sectionBars([section('I. 회사의 개요', 3), section('II. 사업의 내용', 31), section('III. 재무에 관한 사항', 3)])
    expect(result.bars.map((b) => b.title)).toEqual(['II. 사업의 내용', 'I. 회사의 개요', 'III. 재무에 관한 사항'])
  })

  it('막대 길이는 가장 많은 섹션을 100으로 둔 비율이다', () => {
    const result = sectionBars([section('A', 10), section('B', 40)])
    expect(result.bars.map((b) => b.width)).toEqual([100, 25])
  })

  it('건수가 0인 섹션은 그리지도 묶지도 않는다', () => {
    const result = sectionBars([section('A', 0), section('B', 2)], 1)
    expect(result).toEqual({ bars: [{ title: 'B', label: 'B', count: 2, width: 100 }], restSections: 0, restCount: 0 })
  })

  it('상위 개수 밖의 섹션은 섹션 수와 건수 합으로 묶는다', () => {
    const sections = Array.from({ length: 10 }, (_, i) => section(`S${i}`, i + 1))
    const result = sectionBars(sections)
    expect(result.bars).toHaveLength(8)
    expect(result.bars[0]).toMatchObject({ title: 'S9', count: 10 })
    expect(result.restSections).toBe(2)
    expect(result.restCount).toBe(3)
  })

  it('목차 밖 본문은 화면 표시 이름으로 보이고 거르기 값은 원래 제목을 쓴다', () => {
    const [bar] = sectionBars([section('(목차 밖 본문)', 4)]).bars
    expect(bar).toMatchObject({ title: '(목차 밖 본문)', label: '표지·목차 앞 내용' })
  })

  it('섹션이 없거나 모두 0건이면 막대가 없다', () => {
    expect(sectionBars([]).bars).toEqual([])
    expect(sectionBars([section('A', 0)]).bars).toEqual([])
  })
})
