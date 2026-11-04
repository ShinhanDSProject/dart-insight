// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/shared/api/client'
import type { AuthState } from '@/shared/auth/authContext'
import { axeViolations } from '@/test/axe'
import { noteItem } from '@/test/fixtures/notes'
import { ChatConfirmAction, type ConfirmTarget } from './ChatConfirmAction'

const auth = vi.hoisted(() => ({ state: { status: 'anonymous' } as AuthState }))
vi.mock('@/shared/auth/authContext', () => ({
  useAuth: () => ({ state: auth.state, login: vi.fn(), logout: vi.fn() }),
}))
const api = vi.hoisted(() => ({ createNote: vi.fn(), addFavoriteCompany: vi.fn() }))
vi.mock('@/shared/api/notes', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/shared/api/notes')>()),
  createNote: api.createNote,
}))
vi.mock('@/shared/api/favoriteCompanies', () => ({ addFavoriteCompany: api.addFavoriteCompany }))

const note: ConfirmTarget = {
  kind: 'save-note',
  note: { kind: 'ANSWER_CITATION', analysisId: 42, questionId: 7, citationNo: 1, memo: null },
}
const favorite: ConfirmTarget = { kind: 'favorite', corpCode: '00126380' }

function renderConfirm(state: AuthState, target: ConfirmTarget, label = '노트에 담기', done = false, onDone = vi.fn()) {
  auth.state = state
  return render(
    <MemoryRouter>
      <ChatConfirmAction target={target} label={label} done={done} onDone={onDone} />
    </MemoryRouter>,
  )
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('ChatConfirmAction', () => {
  it('확인을 누르기 전에는 저장하지 않고, 누르면 받은 본문 그대로 노트에 담는다(AC9)', async () => {
    api.createNote.mockResolvedValue(noteItem())
    renderConfirm({ status: 'authenticated', userId: 1 }, note)
    expect(api.createNote).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: '노트에 담기' }))
    expect(api.createNote).toHaveBeenCalledWith(note.note)
    expect(await screen.findByText(/노트에 담았어요/)).toBeTruthy()
    expect(screen.getByRole('link', { name: '내 판단 노트 보기' }).getAttribute('href')).toBe('/notes')
  })

  it('저장을 마치면 알리고, 이미 저장한 버튼은 다시 열어도 저장한 결과만 보인다', async () => {
    api.createNote.mockResolvedValue(noteItem())
    const onDone = vi.fn()
    renderConfirm({ status: 'authenticated', userId: 1 }, note, '노트에 담기', false, onDone)
    fireEvent.click(screen.getByRole('button', { name: '노트에 담기' }))
    await screen.findByText(/노트에 담았어요/)
    expect(onDone).toHaveBeenCalledTimes(1)
    cleanup()

    renderConfirm({ status: 'authenticated', userId: 1 }, note, '노트에 담기', true)
    expect(screen.queryByRole('button', { name: '노트에 담기' })).toBeNull()
    expect(screen.getByText(/노트에 담았어요/)).toBeTruthy()
  })

  it('저장에 실패하면 저장을 마친 것으로 알리지 않는다', async () => {
    api.addFavoriteCompany.mockRejectedValue(new Error('network'))
    const onDone = vi.fn()
    renderConfirm({ status: 'authenticated', userId: 1 }, favorite, '관심 기업에 추가', false, onDone)
    fireEvent.click(screen.getByRole('button', { name: '관심 기업에 추가' }))
    await screen.findByRole('alert')
    expect(onDone).not.toHaveBeenCalled()
  })

  it('관심 기업 확인은 누를 때 그 기업을 추가한다', async () => {
    api.addFavoriteCompany.mockResolvedValue({})
    renderConfirm({ status: 'authenticated', userId: 1 }, favorite, '관심 기업에 추가')
    fireEvent.click(screen.getByRole('button', { name: '관심 기업에 추가' }))
    expect(api.addFavoriteCompany).toHaveBeenCalledWith('00126380')
    expect(await screen.findByText('관심 기업에 추가했어요.')).toBeTruthy()
  })

  it('로그인하지 않았으면 버튼 대신 로그인 안내만 보인다(AC10)', async () => {
    const { container } = renderConfirm({ status: 'anonymous' }, favorite, '관심 기업에 추가')
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByText(/로그인하면 이 기업을 관심 기업에 추가할 수 있어요/)).toBeTruthy()
    expect(screen.getByRole('link', { name: '로그인하기' }).getAttribute('href')).toBe('/login')
    expect(api.addFavoriteCompany).not.toHaveBeenCalled()
    expect(await axeViolations(container)).toBe('')
  })

  it('로그인 상태를 확인하는 동안은 버튼을 끈다', () => {
    renderConfirm({ status: 'loading' }, note)
    expect((screen.getByRole('button', { name: '노트에 담기' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('저장에 실패하면 알리고 다시 누를 수 있다', async () => {
    api.createNote.mockRejectedValue(
      new ApiError(401, { code: 'AUTH_UNAUTHORIZED', message: '로그인 필요', traceId: 't', errors: [] }),
    )
    renderConfirm({ status: 'authenticated', userId: 1 }, note)
    fireEvent.click(screen.getByRole('button', { name: '노트에 담기' }))
    expect(await screen.findByText('로그인이 끝났어요. 다시 로그인한 뒤 눌러 주세요.')).toBeTruthy()
    expect((screen.getByRole('button', { name: '노트에 담기' }) as HTMLButtonElement).disabled).toBe(false)
  })
})
