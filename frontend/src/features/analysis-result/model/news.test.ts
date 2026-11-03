import { describe, expect, it } from 'vitest'
import { formatDate } from '@/shared/lib/reportLabels'
import { newsTime } from './news'

describe('newsTime', () => {
  it('기사 시각을 날짜와 시:분으로 보이고, 시각이 없으면 null이다', () => {
    expect(newsTime('2026-11-03T11:52:00')).toBe(`${formatDate('2026-11-03')} 11:52`)
    expect(newsTime(null)).toBeNull()
  })
})
