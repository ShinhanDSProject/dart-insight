import { describe, expect, it } from 'vitest'
import type { Company } from '@/shared/api/companies'
import { sameNameCounts } from './sameName'

const company = (corpCode: string, corpName: string): Company => ({ corpCode, corpName, stockCode: null, listed: false })

describe('sameNameCounts', () => {
  it('이름이 같은 회사가 2곳 이상인 이름만 센다', () => {
    const counts = sameNameCounts([company('1', '삼성물산'), company('2', '삼성물산'), company('3', '삼성전자')])
    expect(counts.get('삼성물산')).toBe(2)
    expect(counts.has('삼성전자')).toBe(false)
  })
})
