// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { NoteList } from '@/shared/api/notes'
import type { AuthState } from '@/shared/auth/authContext'
import { axeViolations } from '@/test/axe'
import { companyNote, noteItem } from '@/test/fixtures/notes'
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
const citationItem = noteItem({
  itemId: 3,
  kind: 'ANSWER_CITATION',
  label: 'II. 사업의 내용 > 1. 사업의 개요',
  text: '반도체 부문의 판매가 늘었습니다.',
  question: '매출이 왜 늘었나요?',
  memo: '답 근거 확인',
  source: { ...noteItem().source, sjDiv: null, changeId: null, questionId: 7, side: 'current', sectionNo: 3, blockNo: 12 },
})
const list: NoteList = {
  companies: [companyNote({ corpCode: '00126380', corpName: '삼성전자', items: [textItem, noteItem({ itemId: 1, memo: null })] })],
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
    expect(screen.getByRole('heading', { level: 1, name: '내 판단 노트' })).toBeTruthy()
    const crumb = screen.getByRole('navigation', { name: '현재 위치' })
    expect(within(crumb).getByRole('link', { name: '기업 검색' }).getAttribute('href')).toBe('/')
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

  it('AI 답 인용은 질문·인용 문단을 보이고 원래 위치 보기가 원문 확인 탭으로 간다', async () => {
    api.getNotes.mockResolvedValue({ companies: [companyNote({ corpCode: '00126380', corpName: '삼성전자', items: [citationItem] })] })
    const { container } = renderPage()
    const card = await screen.findByRole('article', { name: 'II. 사업의 내용 > 1. 사업의 개요 노트' })
    expect(within(card).getByText('AI 답 인용')).toBeTruthy()
    expect(within(card).getByText('매출이 왜 늘었나요?')).toBeTruthy()
    expect(within(card).getByText('반도체 부문의 판매가 늘었습니다.')).toBeTruthy()
    expect(within(card).getByText('접수번호 20261114001234 · 섹션 3 · 문단 12')).toBeTruthy()
    expect(within(card).getByRole('link', { name: '원래 위치 보기' }).getAttribute('href')).toBe(
      '/analyses/42?tab=source&doc=current&section=3&block=12',
    )
    expect(await axeViolations(container)).toBe('')
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

  it('기업 헤더에 기업 개요 보기 링크를 두고, 후속 분석·공시가 없으면 소식 구역을 숨긴다', async () => {
    api.getNotes.mockResolvedValue(list)
    renderPage()
    const company = await screen.findByRole('region', { name: /삼성전자/ })
    expect(within(company).getByRole('link', { name: '삼성전자 기업 개요 보기' }).getAttribute('href')).toBe(
      '/companies/00126380',
    )
    expect(within(company).queryByRole('region', { name: '담은 보고서 이후 소식' })).toBeNull()
    expect(within(company).queryByText('같은 기업에서 이후에 공시된 내역이며 인과관계를 뜻하지 않아요.')).toBeNull()
  })

  it('담은 보고서 이후 소식에 후속 분석·이후 공시·인과관계 안내 문구를 보이고 가치판단 표현이 없다', async () => {
    api.getNotes.mockResolvedValue({
      companies: [
        companyNote({
          corpCode: '00126380',
          corpName: '삼성전자',
          newerAnalyses: [
            {
              analysisId: 108,
              basis: 'YOY',
              previousReportName: '사업보고서 (2025.12)',
              currentRceptNo: '20270330000111',
              currentReportName: '사업보고서 (2026.12)',
            },
          ],
          newerDisclosures: [
            {
              rceptNo: '20261201000001',
              reportName: '단일판매·공급계약체결',
              rceptDt: '2026-12-01',
              disclosureGroup: 'BUSINESS',
              dartUrl: 'https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20261201000001',
            },
          ],
          items: [
            noteItem({
              itemId: 1,
              relatedDisclosures: [
                {
                  rceptNo: '20261120000002',
                  reportName: '연결재무제표기준영업(잠정)실적(공정공시)',
                  rceptDt: '2026-11-20',
                  matchLabel: '실적',
                  dartUrl: 'https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20261120000002',
                },
              ],
            }),
          ],
        }),
      ],
    })
    const { container } = renderPage()
    const followups = await screen.findByRole('region', { name: '담은 보고서 이후 소식' })
    expect(within(followups).getByText('전년 동기')).toBeTruthy()
    expect(
      within(followups).getByRole('link', { name: '사업보고서 (2025.12) → 사업보고서 (2026.12) 분석 보기' }).getAttribute('href'),
    ).toBe('/analyses/108')
    expect(within(followups).getByText('실적·영업')).toBeTruthy()
    expect(within(followups).getByText('단일판매·공급계약체결')).toBeTruthy()
    expect(within(followups).getByText('2026.12.01')).toBeTruthy()
    expect(
      within(followups).getByRole('link', { name: '단일판매·공급계약체결 DART 원문 새 창으로 열기' }).getAttribute('href'),
    ).toBe('https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20261201000001')
    expect(within(followups).getByText('같은 기업에서 이후에 공시된 내역이며 인과관계를 뜻하지 않아요.')).toBeTruthy()

    const card = screen.getByRole('article', { name: '손익계산서 · 매출액 노트' })
    expect(within(card).getByText('관련 후속 공시')).toBeTruthy()
    expect(within(card).getByText('실적')).toBeTruthy()
    expect(within(card).getByText('연결재무제표기준영업(잠정)실적(공정공시)')).toBeTruthy()
    expect(within(card).getByText('2026.11.20')).toBeTruthy()
    expect(
      within(card)
        .getByRole('link', { name: '연결재무제표기준영업(잠정)실적(공정공시) DART 원문 새 창으로 열기' })
        .getAttribute('href'),
    ).toBe('https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20261120000002')

    expect(container.textContent).not.toMatch(/매수|매도|추천|목표주가|저평가|고평가|호재|악재|유망/)
    expect(await axeViolations(container)).toBe('')
  })

  it('메모를 고쳐 관련 후속 공시가 새로 붙으면 사유 배지와 고정 안내 문구를 곧바로 보인다', async () => {
    api.getNotes.mockResolvedValue(list)
    api.updateNoteMemo.mockResolvedValue({
      ...textItem,
      memo: '파운드리 공급계약 추이',
      relatedDisclosures: [
        {
          rceptNo: '20261205000009',
          reportName: '단일판매·공급계약체결(파운드리)',
          rceptDt: '2026-12-05',
          matchLabel: "메모 '파운드리'",
          dartUrl: 'https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20261205000009',
        },
      ],
    })
    renderPage()
    const card = await screen.findByRole('article', { name: 'II. 사업의 내용 > 1. 사업의 개요 노트' })
    fireEvent.click(within(card).getByRole('button', { name: '메모 고치기' }))
    fireEvent.change(within(card).getByRole('textbox', { name: '메모' }), { target: { value: '파운드리 공급계약 추이' } })
    fireEvent.click(within(card).getByRole('button', { name: '메모 저장' }))

    expect(await within(card).findByText("메모 '파운드리'")).toBeTruthy()
    expect(within(card).getByText('단일판매·공급계약체결(파운드리)')).toBeTruthy()
    expect(screen.getByText('같은 기업에서 이후에 공시된 내역이며 인과관계를 뜻하지 않아요.')).toBeTruthy()
  })

  it('검색어·유형 칩·메모 있음 칩으로 기업과 항목을 즉시 거르고 빈 결과에서 필터 초기화로 되돌린다(#535)', async () => {
    api.getNotes.mockResolvedValue({
      companies: [
        companyNote({ corpCode: '00126380', corpName: '삼성전자', items: [textItem, noteItem({ itemId: 1, memo: null })] }),
        companyNote({
          corpCode: '00164779',
          corpName: 'SK하이닉스',
          items: [{ ...citationItem, corpCode: '00164779' }],
        }),
      ],
    })
    const { container } = renderPage()
    await screen.findByRole('region', { name: /삼성전자/ })

    const filterRegion = screen.getByRole('search', { name: '내 판단 노트 거르기' })
    expect(within(filterRegion).getByText('전체 2개 기업 · 3건')).toBeTruthy()
    const kindGroup = within(filterRegion).getByRole('group', { name: '노트 유형' })
    expect(within(kindGroup).getAllByRole('button').map((b) => b.textContent)).toEqual([
      '전체 3',
      '재무 수치 1',
      '문장 변경 1',
      'AI 답 인용 1',
    ])
    const memoChip = within(filterRegion).getByRole('button', { name: /^메모 있음/ })
    expect(memoChip.textContent).toBe('메모 있음 2')

    fireEvent.click(within(kindGroup).getByRole('button', { name: /^AI 답 인용/ }))
    expect(screen.queryByRole('region', { name: /삼성전자/ })).toBeNull()
    expect(screen.getByRole('region', { name: /SK하이닉스/ })).toBeTruthy()
    expect(within(filterRegion).getByText('일치 1개 기업 · 1건 (전체 3건)')).toBeTruthy()

    const searchInput = within(filterRegion).getByRole('searchbox', { name: '노트 찾기' })
    fireEvent.change(searchInput, { target: { value: '없는검색어' } })
    expect(screen.getByText('조건에 맞는 노트가 없어요')).toBeTruthy()
    expect(await axeViolations(container)).toBe('')

    fireEvent.click(screen.getByRole('button', { name: '필터 초기화' }))
    expect(screen.getByRole('region', { name: /삼성전자/ })).toBeTruthy()
    expect(screen.getByRole('region', { name: /SK하이닉스/ })).toBeTruthy()
  })

  it('유효한 재무·문장 노트에만 커뮤니티에 인용 링크를 두고 버전 변경·검토 필요·AI 답 인용에는 두지 않는다(#535)', async () => {
    const validText = noteItem({
      itemId: 10,
      kind: 'TEXT_CHANGE',
      label: 'I. 회사의 개요',
      changeType: 'MODIFIED',
      outdated: false,
      source: { ...noteItem().source, sjDiv: null, changeId: 55 },
    })
    const reviewText = noteItem({
      itemId: 11,
      kind: 'TEXT_CHANGE',
      label: 'IV. 이사의 경영진단',
      changeType: 'REVIEW_NEEDED',
      outdated: false,
      source: { ...noteItem().source, sjDiv: null, changeId: 56 },
    })
    api.getNotes.mockResolvedValue({
      companies: [
        companyNote({
          corpCode: '00126380',
          corpName: '삼성전자',
          items: [noteItem({ itemId: 1 }), validText, textItem, reviewText, citationItem],
        }),
      ],
    })
    renderPage()
    const company = await screen.findByRole('region', { name: /삼성전자/ })

    const financialCard = within(company).getByRole('article', { name: '손익계산서 · 매출액 노트' })
    expect(within(financialCard).getByRole('link', { name: '커뮤니티에 인용' }).getAttribute('href')).toBe(
      '/companies/00126380?view=community&quoteAnalysis=42&quoteKind=FINANCIAL_CHANGE&quoteChange=901&quoteSj=IS',
    )

    const validTextCard = within(company).getByRole('article', { name: 'I. 회사의 개요 노트' })
    expect(within(validTextCard).getByRole('link', { name: '커뮤니티에 인용' }).getAttribute('href')).toBe(
      '/companies/00126380?view=community&quoteAnalysis=42&quoteKind=TEXT_CHANGE&quoteChange=55',
    )

    const reviewCard = within(company).getByRole('article', { name: 'IV. 이사의 경영진단 노트' })
    expect(within(reviewCard).queryByRole('link', { name: '커뮤니티에 인용' })).toBeNull()

    const sameLabelCards = within(company).getAllByRole('article', { name: 'II. 사업의 내용 > 1. 사업의 개요 노트' })
    for (const card of sameLabelCards) {
      expect(within(card).queryByRole('link', { name: '커뮤니티에 인용' })).toBeNull()
    }
  })
})
