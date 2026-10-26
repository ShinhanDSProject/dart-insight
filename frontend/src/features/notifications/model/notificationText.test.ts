import { describe, expect, it } from 'vitest'
import type { AnalysisNotification } from '@/shared/api/notifications'
import { notificationDetail, notificationTime, notificationTitle, unreadLabel } from './notificationText'

const item: AnalysisNotification = {
  notificationId: 7,
  analysisId: 42,
  corpCode: '00126380',
  corpName: '삼성전자',
  basis: 'YOY',
  previous: { rceptNo: '20251114000987', reportName: '분기보고서 (2025.09)', periodEnd: '2025-09-30' },
  current: { rceptNo: '20261114001234', reportName: '분기보고서 (2026.09)', periodEnd: '2026-09-30' },
  createdAt: '2026-11-14T15:20:31',
  readAt: null,
}

describe('notificationText', () => {
  it('기업·새 보고서와 비교 기준·이전 보고서를 문장으로 적는다', () => {
    expect(notificationTitle(item)).toBe('삼성전자 분기보고서 (2026.09) 비교 분석이 끝났어요.')
    expect(notificationDetail(item)).toBe('전년 동기 분기보고서 (2025.09)와 비교했어요.')
  })

  it('기업 이름·보고서가 없으면 고유번호와 일반 이름으로 대신한다', () => {
    const missing = { ...item, corpName: null, current: null, previous: null }
    expect(notificationTitle(missing)).toBe('00126380 새 보고서 비교 분석이 끝났어요.')
    expect(notificationDetail(missing)).toBe('전년 동기 이전 보고서와 비교했어요.')
  })

  it('만든 시각을 날짜와 분까지 보여 준다', () => {
    expect(notificationTime('2026-11-14T15:20:31')).toBe('2026.11.14 15:20')
  })

  it('읽지 않은 알림 수를 버튼 이름에 붙이고 많으면 99+로 줄인다', () => {
    expect(unreadLabel(0)).toBe('알림')
    expect(unreadLabel(3)).toBe('알림 3')
    expect(unreadLabel(120)).toBe('알림 99+')
  })
})
