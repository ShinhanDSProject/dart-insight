// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AnalysisNotification, NotificationList } from '@/shared/api/notifications'
import { axeViolations } from '@/test/axe'
import { NotificationMenu } from './NotificationMenu'

// 서버 대신 고정된 알림 목록을 돌려주고, 읽음 표시 호출을 센다
const api = vi.hoisted(() => ({
  list: { unreadCount: 0, items: [] } as NotificationList,
  read: vi.fn(() => Promise.resolve()),
  unread: vi.fn(() => Promise.resolve()),
}))
vi.mock('@/shared/api/notifications', () => ({
  getNotifications: () => Promise.resolve(api.list),
  markNotificationRead: api.read,
  markNotificationUnread: api.unread,
}))

afterEach(() => {
  cleanup()
  api.read.mockClear()
  api.unread.mockClear()
})

function notification(id: number, readAt: string | null): AnalysisNotification {
  return {
    notificationId: id,
    analysisId: 40 + id,
    corpCode: '00126380',
    corpName: '삼성전자',
    basis: 'YOY',
    previous: { rceptNo: '20251114000987', reportName: '분기보고서 (2025.09)', periodEnd: '2025-09-30' },
    current: { rceptNo: '20261114001234', reportName: '분기보고서 (2026.09)', periodEnd: '2026-09-30' },
    createdAt: '2026-11-14T15:20:31',
    readAt,
  }
}

function renderMenu() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<NotificationMenu refreshKey="/" />} />
        <Route path="/analyses/:analysisId" element={<p>결과 화면</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('NotificationMenu', () => {
  it('읽지 않은 알림 수를 버튼에 보이고, 열면 알림과 비교 보고서·시각을 보여 준다', async () => {
    api.list = { unreadCount: 1, items: [notification(1, null), notification(2, '2026-11-14T16:00:00')] }
    const { container } = renderMenu()

    const button = await screen.findByRole('button', { name: '알림, 읽지 않은 알림 1개' })
    expect(button.textContent).toBe('알림 1')
    fireEvent.click(button)

    const items = screen.getAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(items[0].textContent).toContain('새 알림')
    expect(items[0].textContent).toContain('삼성전자 분기보고서 (2026.09) 비교 분석이 끝났어요.')
    expect(items[0].textContent).toContain('전년 동기 분기보고서 (2025.09)와 비교했어요.')
    expect(items[0].textContent).toContain('2026.11.14 15:20')
    expect(items[1].textContent).not.toContain('새 알림')
    expect(await axeViolations(container)).toBe('')
  })

  it('알림을 누르면 읽음으로 표시하고 그 분석 결과로 간다', async () => {
    api.list = { unreadCount: 1, items: [notification(1, null)] }
    renderMenu()
    fireEvent.click(await screen.findByRole('button', { name: '알림, 읽지 않은 알림 1개' }))

    fireEvent.click(screen.getByRole('link', { name: /삼성전자 분기보고서/ }))

    await screen.findByText('결과 화면')
    expect(api.read).toHaveBeenCalledWith(1)
  })

  it('줄마다 읽음·안 읽음으로 바꿀 수 있다', async () => {
    api.list = { unreadCount: 1, items: [notification(1, null), notification(2, '2026-11-14T16:00:00')] }
    renderMenu()
    fireEvent.click(await screen.findByRole('button', { name: '알림, 읽지 않은 알림 1개' }))

    fireEvent.click(screen.getByRole('button', { name: '읽음으로 표시' }))
    fireEvent.click(screen.getByRole('button', { name: '안 읽음으로 표시' }))

    await waitFor(() => expect(api.read).toHaveBeenCalledWith(1))
    await waitFor(() => expect(api.unread).toHaveBeenCalledWith(2))
  })

  it('알림이 없으면 언제 알림이 오는지 안내하고, Esc로 닫으면 버튼으로 돌아간다', async () => {
    api.list = { unreadCount: 0, items: [] }
    renderMenu()
    const button = await screen.findByRole('button', { name: '알림' })
    fireEvent.click(button)
    await screen.findByText(/아직 알림이 없어요/)

    fireEvent.keyDown(button, { key: 'Escape' })

    expect(screen.queryByText(/아직 알림이 없어요/)).toBeNull()
    expect(button.getAttribute('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(button)
  })
})
