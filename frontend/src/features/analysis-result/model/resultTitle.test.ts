import { describe, expect, it } from 'vitest'
import { resultTabLabels, resultTitle } from './resultTitle'

const analysis = {
  corpName: '삼성전자',
  status: 'COMPLETED' as const,
  previous: { reportName: '사업보고서 (2024.12)' },
  current: { reportName: '반기보고서 (2025.06)' },
}

describe('resultTitle', () => {
  it('분석을 불러오기 전에는 화면 이름만 쓴다', () => {
    expect(resultTitle(null, 'summary')).toBe('분석 결과 · DART Insight')
  })

  it('완료된 분석은 회사명·두 보고서 뒤에 지금 탭 이름을 붙인다', () => {
    expect(resultTitle(analysis, 'ask')).toBe(
      '삼성전자 사업보고서 (2024.12) → 반기보고서 (2025.06) · AI 질문 · DART Insight',
    )
  })

  it('탭을 바꾸면 탭 이름만 바뀐다', () => {
    expect(resultTitle(analysis, 'financial')).toBe(
      '삼성전자 사업보고서 (2024.12) → 반기보고서 (2025.06) · 재무 수치 변화 · DART Insight',
    )
  })

  it('완료되지 않은 분석은 탭이 보이지 않으므로 탭 이름을 붙이지 않는다', () => {
    expect(resultTitle({ ...analysis, status: 'FAILED' }, 'ask')).toBe(
      '삼성전자 사업보고서 (2024.12) → 반기보고서 (2025.06) · DART Insight',
    )
  })

  it('모든 탭에 이름이 있다', () => {
    expect(Object.values(resultTabLabels).every((label) => label !== '')).toBe(true)
  })
})
