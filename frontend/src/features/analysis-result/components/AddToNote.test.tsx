// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/shared/api/client'
import type { AuthState } from '@/shared/auth/authContext'
import { axeViolations } from '@/test/axe'
import type { QuestionAnswer } from '@/shared/api/questions'
import { noteItem } from '@/test/fixtures/notes'
import { AddToNote } from './AddToNote'
import { AnswerCard } from './AnswerCard'

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
      <AddToNote target={{ kind: 'FINANCIAL_CHANGE', changeId: 901 }} analysisId={42} label="매출액" />
    </MemoryRouter>,
  )
}

const answer: QuestionAnswer = {
  questionId: 7,
  question: '매출이 왜 늘었나요?',
  status: 'ANSWERED',
  answer: '반도체 판매가 늘었어요[1].',
  message: null,
  citations: [
    {
      no: 1,
      evidenceId: '20250814000123#B12',
      side: 'current',
      rceptNo: '20250814000123',
      reportName: '반기보고서 (2025.06)',
      sectionNo: 3,
      blockNo: 12,
      sectionPath: 'II. 사업의 내용 > 1. 사업의 개요',
      quote: '반도체 부문의 판매가 늘었습니다.',
    },
  ],
  facts: [],
  aiGenerated: true,
  ai: null,
  feedback: null,
  createdAt: '2025-10-20T10:00:00+09:00',
}

function renderAnswer(state: AuthState, analysisId?: number) {
  auth.state = state
  const links = { onOpenSource: vi.fn(), onOpenFinancial: vi.fn(), onSearchText: vi.fn() }
  return render(
    <MemoryRouter>
      <main>
        <AnswerCard
          item={answer}
          analysisId={analysisId}
          links={links}
          onFeedback={() => Promise.resolve()}
          followUp={{ questions: [], onAsk: vi.fn(), disabled: false }}
        />
      </main>
    </MemoryRouter>,
  )
}

const CITATION_BUTTON = '노트에 담기: 인용 1 II. 사업의 내용 > 1. 사업의 개요'

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

  it('AI 답의 인용을 담으면 질문 ID·인용 번호와 메모만 보낸다(글은 보내지 않음)', async () => {
    api.createNote.mockResolvedValue(noteItem({ kind: 'ANSWER_CITATION' }))
    renderAnswer({ status: 'authenticated', userId: 1 }, 42)
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

  it('AI 답의 인용도 로그인하지 않았으면 로그인 안내만 보이고, 분석 ID가 없으면 버튼을 두지 않는다', async () => {
    const { container } = renderAnswer({ status: 'anonymous' }, 42)
    fireEvent.click(screen.getByRole('button', { name: CITATION_BUTTON }))
    expect(screen.getByRole('link', { name: '로그인하기' })).toBeTruthy()
    expect(api.createNote).not.toHaveBeenCalled()
    expect(await axeViolations(container)).toBe('')
    cleanup()
    renderAnswer({ status: 'anonymous' })
    expect(screen.queryByRole('button', { name: CITATION_BUTTON })).toBeNull()
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
