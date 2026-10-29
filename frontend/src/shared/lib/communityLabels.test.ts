import { describe, expect, it } from 'vitest'
import { dateTimeLabel, reportReasonOptions } from './communityLabels'

describe('커뮤니티 표시', () => {
  it('한국 시간 시각을 날짜와 시각으로 보인다', () => {
    expect(dateTimeLabel('2026-11-03T10:15:00')).toBe('2026.11.03 10:15')
  })

  it('신고 사유 네 가지를 서버 값 순서대로 둔다', () => {
    expect(reportReasonOptions.map((o) => o.value)).toEqual(['DEFAMATION', 'FALSE_RUMOR', 'PAID_LEADING', 'PERSONAL_INFO'])
  })
})
