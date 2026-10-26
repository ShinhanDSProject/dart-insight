import { describe, expect, it } from 'vitest'
import { collapseList } from './collapsedList'

describe('첫 화면 목록 접기(#374)', () => {
  const items = [1, 2, 3, 4, 5, 6, 7]

  it('접혀 있으면 앞에서 정한 수만 보이고 나머지 수를 알려 준다', () => {
    expect(collapseList(items, 5, false)).toEqual({ shown: [1, 2, 3, 4, 5], hiddenCount: 2, toggleable: true })
  })

  it('펼치면 모두 보이고 버튼은 접기로 남는다', () => {
    expect(collapseList(items, 5, true)).toEqual({ shown: items, hiddenCount: 0, toggleable: true })
  })

  it('정한 수 이하이면 모두 보이고 버튼을 두지 않는다', () => {
    expect(collapseList(items.slice(0, 5), 5, false)).toEqual({ shown: [1, 2, 3, 4, 5], hiddenCount: 0, toggleable: false })
    expect(collapseList([], 5, false)).toEqual({ shown: [], hiddenCount: 0, toggleable: false })
  })
})
