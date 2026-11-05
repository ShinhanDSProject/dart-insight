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
vi.mock('@/shared/auth/authContext', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/shared/auth/authContext')>()),
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
      <AddToNote target={{ kind: 'FINANCIAL_CHANGE', changeId: 901 }} analysisId={42} label="매출액" />
    </MemoryRouter>,
  )
}

function renderCitation(state: AuthState) {
  auth.state = state
  return render(
    <MemoryRouter>
      <AddToNote
        target={{ kind: 'ANSWER_CITATION', questionId: 7, citationNo: 1 }}
        analysisId={42}
        label="인용 1 II. 사업의 내용 > 1. 사업의 개요"
      />
    </MemoryRouter>,
  )
}

const CITATION_BUTTON = '노트에 담기: 인용 1 II. 사업의 내용 > 1. 사업의 개요'

afterEach(() => {
  cleanup()
  api.createNote.mockReset()
})

describe('AddToNote 메뉴에서 열기(3.31)', () => {
  const opened = (openRequest: number, onClose: () => void) => (
    <MemoryRouter>
      <AddToNote target={{ kind: 'TEXT_CHANGE', changeId: 3 }} analysisId={42} label="사업의 개요" openRequest={openRequest} onClose={onClose} />
    </MemoryRouter>
  )
  function renderOpened(state: AuthState, onClose = vi.fn()) {
    auth.state = state
    render(opened(1, onClose))
    return onClose
  }
  const signedIn = { status: 'authenticated', user: { userId: 1 } } as unknown as AuthState

  it('로그인했으면 바로 메모 칸이 열리고, 취소하면 알린다', () => {
    const onClose = renderOpened(signedIn)
    expect(screen.getByLabelText(/메모/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '취소' }))
    expect(onClose).toHaveBeenCalled()
  })

  it('로그인하지 않았으면 바로 안내가 보이고, 닫으면 알린다', () => {
    const onClose = renderOpened({ status: 'anonymous' })
    expect(screen.getByRole('link', { name: '로그인하기' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '닫기' }))
    expect(onClose).toHaveBeenCalled()
  })

  it('로그인 상태를 아직 모르면 눌리지 않는 버튼을 둔다', () => {
    renderOpened({ status: 'loading' })
    expect((screen.getByRole('button', { name: /노트에 담기/ }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('로그인 상태를 모를 때 고른 요청은 확인이 끝나면 다시 누르지 않아도 열린다', () => {
    auth.state = { status: 'loading' }
    const { rerender } = render(opened(1, vi.fn()))
    auth.state = signedIn
    rerender(opened(1, vi.fn()))
    expect(screen.getByLabelText(/메모/)).toBeTruthy()
  })

  it('저장한 뒤에는 안내만 보이고 버튼이 다시 나오지 않으며, 메뉴에서 또 고르면 메모 칸이 열린다', async () => {
    api.createNote.mockResolvedValue(noteItem())
    auth.state = signedIn
    const { rerender } = render(opened(1, vi.fn()))
    fireEvent.click(screen.getByRole('button', { name: '노트에 저장' }))
    expect(await screen.findByRole('link', { name: '내 판단 노트 보기' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /노트에 담기/ })).toBeNull()
    rerender(opened(2, vi.fn()))
    expect(screen.getByLabelText(/메모/)).toBeTruthy()
    expect(screen.queryByRole('link', { name: '내 판단 노트 보기' })).toBeNull()
  })

  it('메모를 쓰는 중에 메뉴에서 또 골라도 쓴 내용이 남는다', () => {
    auth.state = signedIn
    const { rerender } = render(opened(1, vi.fn()))
    fireEvent.change(screen.getByLabelText(/메모/), { target: { value: '다시 볼 것' } })
    rerender(opened(2, vi.fn()))
    expect((screen.getByLabelText(/메모/) as HTMLTextAreaElement).value).toBe('다시 볼 것')
  })
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

  it('AI 답의 인용을 담으면 질문 ID·인용 번호와 메모만 보낸다(글은 보내지 않음)', async () => {
    api.createNote.mockResolvedValue(noteItem({ kind: 'ANSWER_CITATION' }))
    renderCitation({ status: 'authenticated', userId: 1 })
    fireEvent.click(screen.getByRole('button', { name: CITATION_BUTTON }))
    fireEvent.change(screen.getByRole('textbox', { name: '메모(선택)' }), { target: { value: '설명 확인' } })
    fireEvent.click(screen.getByRole('button', { name: '노트에 저장' }))
    expect(await screen.findByText(/노트에 담았어요/)).toBeTruthy()
    expect(api.createNote).toHaveBeenCalledWith({
      kind: 'ANSWER_CITATION',
      questionId: 7,
      citationNo: 1,
      analysisId: 42,
      memo: '설명 확인',
    })
  })

  it('AI 답의 인용도 로그인하지 않았으면 로그인 안내만 보인다', async () => {
    const { container } = renderCitation({ status: 'anonymous' })
    fireEvent.click(screen.getByRole('button', { name: CITATION_BUTTON }))
    expect(screen.getByRole('link', { name: '로그인하기' })).toBeTruthy()
    expect(api.createNote).not.toHaveBeenCalled()
    expect(await axeViolations(container)).toBe('')
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
