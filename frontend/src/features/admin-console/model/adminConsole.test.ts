import { describe, expect, it } from 'vitest'
import {
  barPercent,
  lastPage,
  normalizeQuery,
  parseAnalysisDays,
  parseAnalysisStatus,
  parseOverviewDays,
  parsePage,
  parseRole,
  planLabel,
  providerLabel,
  shortDate,
  shortDateTime,
  statusLabel,
  stepLabel,
  statusTone,
} from './adminConsole'

describe('adminConsole 주소 값', () => {
  it('개요 기간은 30만 30이고 나머지는 7이다', () => {
    expect(parseOverviewDays('30')).toBe(30)
    expect(parseOverviewDays('7')).toBe(7)
    expect(parseOverviewDays(null)).toBe(7)
    expect(parseOverviewDays('90')).toBe(7)
  })

  it('분석 작업 기간·상태·역할은 정한 값만 받고 아니면 null이다', () => {
    expect(parseAnalysisDays('1')).toBe(1)
    expect(parseAnalysisDays('30')).toBe(30)
    expect(parseAnalysisDays('2')).toBeNull()
    expect(parseAnalysisStatus('FAILED')).toBe('FAILED')
    expect(parseAnalysisStatus('failed')).toBeNull()
    expect(parseRole('ADMIN')).toBe('ADMIN')
    expect(parseRole('OWNER')).toBeNull()
  })

  it('쪽 번호는 1부터인 주소 값을 0부터로 바꾸고 잘못된 값은 0이다', () => {
    expect(parsePage('3')).toBe(2)
    expect(parsePage('0')).toBe(0)
    expect(parsePage('abc')).toBe(0)
    expect(parsePage(null)).toBe(0)
    expect(lastPage(41, 20)).toBe(2)
    expect(lastPage(0, 20)).toBe(0)
  })

  it('검색어는 앞뒤 공백을 지우고 비면 null, 50자를 넘으면 자른다', () => {
    expect(normalizeQuery('  삼성전자 ')).toBe('삼성전자')
    expect(normalizeQuery('   ')).toBeNull()
    expect(normalizeQuery('가'.repeat(60))).toHaveLength(50)
  })
})

describe('adminConsole 표시 문구', () => {
  it('상태·가입 방식·요금제를 한국어로 보이고 실패는 위험 색이다', () => {
    expect(statusLabel('RUNNING')).toBe('진행 중')
    expect(stepLabel('VERIFYING')).toBe('검증')
    expect(statusTone('FAILED')).toBe('danger')
    expect(statusTone('COMPLETED')).toBe('neutral')
    expect(providerLabel('KAKAO')).toBe('카카오')
    expect(planLabel('EMBED')).toBe('임베드·데이터')
  })

  it('날짜와 시각을 짧게 쓰고 막대 비율은 가장 큰 값 기준이다', () => {
    expect(shortDate('2026-11-04')).toBe('11/04')
    expect(shortDateTime('2026-11-03T14:01:02')).toBe('11/03 14:01')
    expect(barPercent(9, 18)).toBe(50)
    expect(barPercent(3, 0)).toBe(0)
  })
})
