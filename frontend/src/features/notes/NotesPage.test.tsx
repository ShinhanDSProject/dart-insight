// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { NoteList } from '@/shared/api/notes'
import type { AuthState } from '@/shared/auth/authContext'
import { axeViolations } from '@/test/axe'
import { noteItem } from '@/test/fixtures/notes'
import { NotesPage } from './NotesPage'

const auth = vi.hoisted(() => ({ state: { status: 'authenticated', userId: 1 } as AuthState }))
vi.mock('@/shared/auth/authContext', () => ({
  useAuth: () => ({ state: auth.state, login: vi.fn(), logout: vi.fn() }),
}))
const api = vi.hoisted(() => ({ getNotes: vi.fn(), updateNoteMemo: vi.fn(), deleteNote: vi.fn(), exportNotes: vi.fn() }))
vi.mock('@/shared/api/notes', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/shared/api/notes')>()),
  ...api,
}))
const download = vi.hoisted(() => ({ downloadTextFile: vi.fn() }))
vi.mock('@/shared/lib/download', () => download)

const textItem = noteItem({
  itemId: 2,
  kind: 'TEXT_CHANGE',
  label: 'II. 사업의 내용 > 1. 사업의 개요',
  text: '당사는 메모리와 파운드리를 만듭니다.',
  changeType: 'MODIFIED',
  memo: '사업 범위 확장',
  outdated: true,
  source: { ...noteItem().source, analysisVersion: 'm1-old', sjDiv: null, changeId: 77, sectionNo: 2, blockNo: 1 },
})
const list: NoteList = {
  companies: [{ corpCode: '00126380', corpName: '삼성전자', items: [textItem, noteItem({ itemId: 1, memo: null })] }],
}

function renderPage(state: AuthState = { status: 'authenticated', userId: 1 }) {
  auth.state = state
  return render(
    <MemoryRouter>
      <NotesPage />
    </MemoryRouter>,
  )
}

afterEach(() => {
  cleanup()
  Object.values(api).forEach((fn) => fn.mockReset())
  download.downloadTextFile.mockReset()
})

describe('NotesPage(FS-57)', () => {
  it('로그인하지 않았으면 서버를 부르지 않고 로그인 안내를 보인다', () => {
    renderPage({ status: 'anonymous' })
    expect(screen.getByText('로그인하면 판단 노트를 쓸 수 있어요')).toBeTruthy()
    expect(screen.getByRole('link', { name: '로그인하기' }).getAttribute('href')).toBe('/login')
    expect(api.getNotes).not.toHaveBeenCalled()
  })

  it('불러오는 동안 로딩, 실패하면 다시 시도를 보인다', async () => {
    api.getNotes.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce({ companies: [] })
    renderPage()
    expect(screen.getByRole('status').textContent).toContain('불러오는 중')
    fireEvent.click(await screen.findByRole('button', { name: '다시 시도' }))
    expect(await screen.findByText('아직 담은 근거가 없어요')).toBeTruthy()
  })

  it('기업별로 담은 값·문장·메모와 원래 위치 링크, 버전 안내를 보인다', async () => {
    api.getNotes.mockResolvedValue(list)
    renderPage()
    const company = await screen.findByRole('region', { name: /삼성전자/ })
    const text = within(company).getByRole('article', { name: 'II. 사업의 내용 > 1. 사업의 개요 노트' })
    expect(within(text).getByText('당사는 메모리와 파운드리를 만듭니다.')).toBeTruthy()
    expect(within(text).getByText('사업 범위 확장')).toBeTruthy()
    expect(within(text).getByText(/분석 방식이 바뀌어 위치가 달라졌을 수 있어요/)).toBeTruthy()
    expect(within(text).getByText('접수번호 20261114001234 · 섹션 2 · 문단 1')).toBeTruthy()
    expect(within(text).getByRole('link', { name: '원래 위치 보기' }).getAttribute('href')).toBe('/analyses/42?tab=text&tc=77')

    const financial = within(company).getByRole('article', { name: '손익계산서 · 매출액 노트' })
    expect(within(financial).getByRole('link', { name: '원래 위치 보기' }).getAttribute('href')).toBe(
      '/analyses/42?tab=financial&sj=IS&change=901',
    )
    expect(within(financial).queryByText(/위치가 달라졌을 수 있어요/)).toBeNull()
    expect(within(financial).getByText('메모가 없어요.')).toBeTruthy()
  })

  it('메모를 고치면 서버가 답한 메모로 바꾼다', async () => {
    api.getNotes.mockResolvedValue(list)
    api.updateNoteMemo.mockResolvedValue({ ...textItem, memo: '고친 메모' })
    renderPage()
    const card = await screen.findByRole('article', { name: 'II. 사업의 내용 > 1. 사업의 개요 노트' })
    fireEvent.click(within(card).getByRole('button', { name: '메모 고치기' }))
    fireEvent.change(within(card).getByRole('textbox', { name: '메모' }), { target: { value: '고친 메모' } })
    fireEvent.click(within(card).getByRole('button', { name: '메모 저장' }))
    expect(await within(card).findByText('고친 메모')).toBeTruthy()
    expect(api.updateNoteMemo).toHaveBeenCalledWith(2, '고친 메모')
  })

  it('지우면 그 항목만 빠진다', async () => {
    api.getNotes.mockResolvedValue(list)
    api.deleteNote.mockResolvedValue(undefined)
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: '지우기: 손익계산서 · 매출액' }))
    await waitFor(() => expect(screen.queryByRole('article', { name: '손익계산서 · 매출액 노트' })).toBeNull())
    expect(api.deleteNote).toHaveBeenCalledWith(1)
    expect(screen.getByRole('article', { name: 'II. 사업의 내용 > 1. 사업의 개요 노트' })).toBeTruthy()
  })

  it('내보내기를 누르면 서버의 Markdown을 파일로 받는다', async () => {
    api.getNotes.mockResolvedValue(list)
    api.exportNotes.mockResolvedValue('# 삼성전자 판단 노트\n')
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: '삼성전자 노트 내보내기' }))
    await waitFor(() =>
      expect(download.downloadTextFile).toHaveBeenCalledWith(
        'judgment-note-00126380.md',
        '# 삼성전자 판단 노트\n',
        'text/markdown;charset=utf-8',
      ),
    )
    expect(api.exportNotes).toHaveBeenCalledWith('00126380')
  })

  it('목록 화면에 접근성 위반이 없다', async () => {
    api.getNotes.mockResolvedValue(list)
    const { container } = renderPage()
    await screen.findByRole('region', { name: /삼성전자/ })
    expect(await axeViolations(container)).toBe('')
  })
})
