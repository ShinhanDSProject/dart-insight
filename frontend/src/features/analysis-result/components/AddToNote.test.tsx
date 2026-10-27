// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/shared/api/client'
import type { AuthState } from '@/shared/auth/authContext'
import { axeViolations } from '@/test/axe'
import { noteItem } from '@/test/fixtures/notes'
import { AddToNote } from './AddToNote'

const auth = vi.hoisted(() => ({ state: { status: 'anonymous' } as AuthState }))
vi.mock('@/shared/auth/authContext', () => ({
  useAuth: () => ({ state: auth.state, login: vi.fn(), logout: vi.fn() }),
}))
const api = vi.hoisted(() => ({ createNote: vi.fn() }))
vi.mock('@/shared/api/notes', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/shared/api/notes')>()),
  createNote: api.createNote,
}))

function renderAdd(state: AuthState) {
  auth.state = state
  return render(
    <MemoryRouter>
      <AddToNote kind="FINANCIAL_CHANGE" analysisId={42} changeId={901} label="매출액" />
    </MemoryRouter>,
  )
}

afterEach(() => {
  cleanup()
  api.createNote.mockReset()
})

describe('AddToNote(FS-57)', () => {
  it('로그인하지 않았으면 로그인 안내만 보이고 저장하지 않는다', () => {
    renderAdd({ status: 'anonymous' })
    fireEvent.click(screen.getByRole('button', { name: '노트에 담기: 매출액' }))
    expect(screen.getByRole('link', { name: '로그인하기' }).getAttribute('href')).toBe('/login')
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(api.createNote).not.toHaveBeenCalled()
  })

  it('메모를 쓰고 저장하면 분석·변경 ID와 메모만 보내고 담았다고 알린다', async () => {
    api.createNote.mockResolvedValue(noteItem())
    renderAdd({ status: 'authenticated', userId: 1 })
    fireEvent.click(screen.getByRole('button', { name: '노트에 담기: 매출액' }))
    fireEvent.change(screen.getByRole('textbox', { name: '메모(선택)' }), { target: { value: '  환율 효과 확인 ' } })
    fireEvent.click(screen.getByRole('button', { name: '노트에 저장' }))

    expect(await screen.findByText(/노트에 담았어요/)).toBeTruthy()
    expect(api.createNote).toHaveBeenCalledWith({ kind: 'FINANCIAL_CHANGE', analysisId: 42, changeId: 901, memo: '환율 효과 확인' })
    expect(screen.getByRole('link', { name: '내 판단 노트 보기' }).getAttribute('href')).toBe('/notes')
  })

  it('메모 없이 저장하면 memo를 null로 보낸다', async () => {
    api.createNote.mockResolvedValue(noteItem())
    renderAdd({ status: 'authenticated', userId: 1 })
    fireEvent.click(screen.getByRole('button', { name: '노트에 담기: 매출액' }))
    fireEvent.click(screen.getByRole('button', { name: '노트에 저장' }))
    await screen.findByText(/노트에 담았어요/)
    expect(api.createNote).toHaveBeenCalledWith(expect.objectContaining({ memo: null }))
  })

  it('메모가 1,000자를 넘으면 저장 버튼을 끈다', () => {
    renderAdd({ status: 'authenticated', userId: 1 })
    fireEvent.click(screen.getByRole('button', { name: '노트에 담기: 매출액' }))
    fireEvent.change(screen.getByRole('textbox', { name: '메모(선택)' }), { target: { value: '가'.repeat(1001) } })
    expect(screen.getByRole('button', { name: '노트에 저장' })).toHaveProperty('disabled', true)
  })

  it('저장이 실패하면 메모 칸을 남기고 오류를 보인다', async () => {
    api.createNote.mockRejectedValue(new ApiError(409, { code: 'ANALYSIS_NOT_READY', message: '분석이 아직 끝나지 않았습니다.', traceId: null, errors: [] }))
    renderAdd({ status: 'authenticated', userId: 1 })
    fireEvent.click(screen.getByRole('button', { name: '노트에 담기: 매출액' }))
    fireEvent.click(screen.getByRole('button', { name: '노트에 저장' }))
    expect((await screen.findByRole('alert')).textContent).toContain('분석이 아직 끝나지 않았습니다.')
    expect(screen.getByRole('textbox', { name: '메모(선택)' })).toBeTruthy()
  })

  it('메모 칸과 로그인 안내에 접근성 위반이 없다', async () => {
    const { container } = renderAdd({ status: 'authenticated', userId: 1 })
    fireEvent.click(screen.getByRole('button', { name: '노트에 담기: 매출액' }))
    expect(await axeViolations(container)).toBe('')
    cleanup()
    const anonymous = renderAdd({ status: 'anonymous' })
    fireEvent.click(screen.getByRole('button', { name: '노트에 담기: 매출액' }))
    expect(await axeViolations(anonymous.container)).toBe('')
  })
})
