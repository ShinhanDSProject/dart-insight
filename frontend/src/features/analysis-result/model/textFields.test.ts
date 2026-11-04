import { describe, expect, it } from 'vitest'
import type { TextField, TextListing } from '@/shared/api/textChanges'
import { fieldCellValue, fieldTableView, parseTextField, resolveTextField, textFieldLabel } from './textFields'

const fieldCounts: Record<TextField, number> = {
  LITIGATION: 38,
  CONTRACT: 11,
  BUSINESS: 247,
  DIVIDEND: 0,
  FUNDING: 46,
  BOARD: 93,
  SHAREHOLDER: 0,
  AUDIT: 15,
  OTHER: 132,
}
const listing: TextListing = { listVersion: 'text-list-1', fieldCounts, missingFields: ['SHAREHOLDER'], groupCounts: null }

function cellOf(field: TextField) {
  const view = fieldTableView(listing)
  if (view.kind !== 'table') throw new Error('표가 아니에요')
  const cell = view.cells.find((c) => c.field === field)
  if (cell === undefined) throw new Error('칸이 없어요')
  return cell
}

describe('fieldTableView', () => {
  it('아직 응답을 받지 못했으면 로딩이다', () => {
    expect(fieldTableView(null)).toEqual({ kind: 'loading' })
  })

  it('옛 분석이나 변경이 없는 분석(listVersion null)이면 표를 그리지 않는다', () => {
    expect(fieldTableView({ listVersion: null, fieldCounts: null, missingFields: null, groupCounts: null })).toEqual({ kind: 'hidden' })
  })

  it('9칸을 명세의 순서로 만들고 합계는 칸의 건수를 더한 값이다(AC1)', () => {
    const view = fieldTableView(listing)
    if (view.kind !== 'table') throw new Error('표가 아니에요')
    expect(view.cells.map((c) => c.field)).toEqual([
      'LITIGATION',
      'CONTRACT',
      'BUSINESS',
      'DIVIDEND',
      'FUNDING',
      'BOARD',
      'SHAREHOLDER',
      'AUDIT',
      'OTHER',
    ])
    expect(view.total).toBe(582)
  })

  it('건수가 있으면 건수로 보인다', () => {
    expect(cellOf('LITIGATION')).toMatchObject({ label: '소송·제재', count: 38, state: 'changed' })
  })

  it('0건이고 섹션이 있으면 확인된 변화 없음이다(AC2)', () => {
    expect(cellOf('DIVIDEND')).toMatchObject({ count: 0, state: 'no-change' })
  })

  it('0건이고 missingFields에 있으면 보고서에 해당 내용 없음이다(AC2)', () => {
    expect(cellOf('SHAREHOLDER')).toMatchObject({ count: 0, state: 'no-section' })
  })
})

describe('parseTextField', () => {
  it('아는 분야만 읽고 모르는 값과 빈 값은 null로 본다', () => {
    expect(parseTextField('AUDIT')).toBe('AUDIT')
    expect(parseTextField('audit')).toBeNull()
    expect(parseTextField('NOPE')).toBeNull()
    expect(parseTextField(null)).toBeNull()
  })
})

describe('textFieldLabel', () => {
  it('분야의 화면 이름을 돌려준다', () => {
    expect(textFieldLabel('OTHER')).toBe('그 밖의 변경')
  })
})

describe('fieldCellValue', () => {
  it('상태마다 칸에 보일 글을 돌려준다(AC2)', () => {
    expect(fieldCellValue(cellOf('LITIGATION'))).toBe('38건')
    expect(fieldCellValue(cellOf('DIVIDEND'))).toBe('확인된 변화 없음')
    expect(fieldCellValue(cellOf('SHAREHOLDER'))).toBe('보고서에 해당 내용 없음')
  })
})

describe('resolveTextField', () => {
  it('옛 분석이면 주소의 분야를 쓰지 않고, 응답 전이나 새 분석이면 그대로 둔다', () => {
    expect(resolveTextField('AUDIT', { listVersion: null, fieldCounts: null, missingFields: null, groupCounts: null })).toBeNull()
    expect(resolveTextField('AUDIT', null)).toBe('AUDIT')
    expect(resolveTextField('AUDIT', listing)).toBe('AUDIT')
  })
})
