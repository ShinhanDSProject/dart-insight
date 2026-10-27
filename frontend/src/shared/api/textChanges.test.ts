import { describe, expect, it } from 'vitest'
import { textChangeParams } from './textChanges'

const base = { sort: 'priority' as const, section: null, q: null, page: 0 }

describe('textChangeParams', () => {
  it('유형이 없으면 type을 보내지 않는다', () => {
    expect(textChangeParams({ ...base, types: [] }).type).toBeUndefined()
  })

  it('유형 하나는 그대로 보낸다', () => {
    expect(textChangeParams({ ...base, types: ['MOVED'] }).type).toBe('MOVED')
  })

  it('유형 여러 개는 쉼표로 잇는다', () => {
    expect(textChangeParams({ ...base, types: ['ADDED', 'DELETED', 'MODIFIED'] })).toEqual({
      type: 'ADDED,DELETED,MODIFIED',
      sort: 'priority',
      section: undefined,
      q: undefined,
      page: 0,
      size: 20,
    })
  })

  it('위험 관련만 볼 때만 risk=true를 보낸다(3.9)', () => {
    expect(textChangeParams({ ...base, types: [], risk: true }).risk).toBe(true)
    expect(textChangeParams({ ...base, types: [], risk: false }).risk).toBeUndefined()
    expect(textChangeParams({ ...base, types: [] }).risk).toBeUndefined()
  })
})
