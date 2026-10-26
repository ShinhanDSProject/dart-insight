import { describe, expect, it } from 'vitest'
import { sectionChangeCounts } from './sectionChangeCounts'

describe('목차 섹션별 변경 건수', () => {
  it('원래 섹션 제목을 키로 건수를 담고 표시 이름으로 바꾸지 않는다', () => {
    const counts = sectionChangeCounts([
      { title: 'III. 재무에 관한 사항', count: 448 },
      { title: '(목차 밖 본문)', count: 4 },
    ])
    expect(counts.get('III. 재무에 관한 사항')).toBe(448)
    expect(counts.get('(목차 밖 본문)')).toBe(4)
    expect(counts.has('표지·목차 앞 내용')).toBe(false)
  })

  it('건수가 0인 섹션은 넣지 않는다', () => {
    const counts = sectionChangeCounts([
      { title: 'I. 회사의 개요', count: 0 },
      { title: 'II. 사업의 내용', count: 3 },
    ])
    expect([...counts.keys()]).toEqual(['II. 사업의 내용'])
  })

  it('같은 제목이 두 번 오면 건수를 더한다', () => {
    const counts = sectionChangeCounts([
      { title: 'II. 사업의 내용', count: 3 },
      { title: 'II. 사업의 내용', count: 2 },
    ])
    expect(counts.get('II. 사업의 내용')).toBe(5)
  })

  it('섹션이 없으면 빈 목록이다', () => {
    expect(sectionChangeCounts([]).size).toBe(0)
  })
})
