// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CompanyAnalysisItem } from '@/shared/api/analyses'
import type { Post, PostList, PostQuote, QuoteRequest } from '@/shared/api/community'
import type { FinancialChangeItem, FinancialChangeList } from '@/shared/api/results'
import type { TextChangeItem, TextChangeList } from '@/shared/api/textChanges'
import { AuthContext, type AuthContextValue } from '@/shared/auth/authContext'
import { axeViolations } from '@/test/axe'
import { CommunityTab } from './CommunityTab'

const api = vi.hoisted(() => ({
  getPosts: vi.fn(),
  createPost: vi.fn(),
  listCompanyAnalyses: vi.fn(),
  getTextChanges: vi.fn(),
  getFinancialChanges: vi.fn(),
}))
vi.mock('@/shared/api/community', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/shared/api/community')>()),
  getPosts: api.getPosts,
  createPost: api.createPost,
}))
vi.mock('@/shared/api/analyses', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/shared/api/analyses')>()),
  listCompanyAnalyses: api.listCompanyAnalyses,
}))
vi.mock('@/shared/api/textChanges', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/shared/api/textChanges')>()),
  getTextChanges: api.getTextChanges,
}))
vi.mock('@/shared/api/results', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/shared/api/results')>()),
  getFinancialChanges: api.getFinancialChanges,
}))

const textQuote: PostQuote = {
  kind: 'TEXT_CHANGE',
  label: 'II. 사업의 내용 > 3. 원재료 및 생산설비',
  text: '당사는 HBM 생산능력을 전년 대비 2배 이상 확대하였습니다.',
  changeType: 'ADDED',
  sjDiv: null,
  reportPair: { previous: '분기보고서 (2025.09)', current: '분기보고서 (2026.09)' },
  source: { analysisId: 42, changeId: 3001, rceptNo: '20261114001234', sectionNo: 12, blockNo: 340 },
  outdated: false,
}

function post(postId: number, overrides: Partial<Post> = {}): Post {
  return {
    postId,
    corpCode: '00126380',
    author: { nickname: '반도체공부중', mine: false },
    state: 'VISIBLE',
    body: `HBM 이야기 ${postId}`,
    quote: null,
    likeCount: 0,
    commentCount: 0,
    liked: false,
    blind: null,
    createdAt: '2026-10-27T10:15:00',
    editedAt: null,
    ...overrides,
  }
}

function list(items: Post[]): PostList {
  return { corpCode: '00126380', sort: 'latest', page: 0, size: 20, totalItems: items.length, items }
}

const analysis: CompanyAnalysisItem = {
  analysisId: 42,
  basis: 'YOY',
  previous: { rceptNo: '20251114000001', reportName: '분기보고서 (2025.09)', periodEnd: '2025-09-30' },
  current: { rceptNo: '20261114001234', reportName: '분기보고서 (2026.09)', periodEnd: '2026-09-30' },
  completedAt: '2026-10-27T09:00:00',
}

function textItem(changeId: number, overrides: Partial<TextChangeItem> = {}): TextChangeItem {
  return {
    changeId,
    changeNo: changeId,
    changeType: 'ADDED',
    blockType: 'PARAGRAPH',
    numbersOnly: false,
    sectionStatus: 'MATCHED',
    sectionTitle: '3. 원재료 및 생산설비',
    sectionPath: 'II. 사업의 내용 > 3. 원재료 및 생산설비',
    previousSectionPath: null,
    previousPreview: null,
    currentPreview: '당사는 HBM 생산능력을 전년 대비 2배 이상 확대하였습니다.',
    similarity: null,
    reviewReason: null,
    priority: null,
    riskRelated: false,
    ...overrides,
  }
}

const counts = { all: 1, added: 1, deleted: 0, modified: 0, numericUpdate: 0, moved: 0, reviewNeeded: 0 }

function textList(items: TextChangeItem[]): TextChangeList {
  return {
    analysisId: 42,
    textStatus: 'COMPLETED',
    textMessage: null,
    type: null,
    sort: 'priority',
    section: null,
    q: null,
    risk: false,
    page: 0,
    size: 20,
    totalItems: items.length,
    counts,
    riskCounts: counts,
    sections: [],
    items,
  }
}

function financialItem(): FinancialChangeItem {
  return {
    changeId: 501,
    sjDiv: 'IS',
    accountName: '매출액',
    accountDetail: null,
    amountBasis: 'CUMULATIVE',
    previousAmount: 1_000_000,
    currentAmount: null,
    changeAmount: null,
    changeRate: null,
    direction: null,
    calcStatus: 'ONLY_PREVIOUS',
    calcMessage: null,
    currency: 'KRW',
    scale: { base: 'REVENUE', baseAccountName: null, baseAmount: null, ratio: null, reason: 'CHANGE_NOT_CALCULATED' },
  }
}

function financialList(sjDiv: 'BS' | 'IS', items: FinancialChangeItem[]): FinancialChangeList {
  const statement = (s: 'BS' | 'IS', label: string, changed: number) => ({
    sjDiv: s,
    label,
    comparable: true,
    amountBasis: null,
    note: null,
    total: 10,
    changed,
  })
  return {
    analysisId: 42,
    fsDiv: 'CFS',
    sjDiv,
    changedOnly: true,
    sort: 'document',
    statements: [statement('BS', '재무상태표', 0), statement('IS', '손익계산서', 1)],
    items,
  }
}

function auth(): AuthContextValue {
  return { state: { status: 'authenticated', userId: 1 }, login: vi.fn(), logout: vi.fn() }
}

function renderTab() {
  return render(
    <AuthContext.Provider value={auth()}>
      <MemoryRouter>
        <CommunityTab corpCode="00126380" />
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

beforeEach(() => {
  api.getPosts.mockResolvedValue(list([post(1)]))
  api.listCompanyAnalyses.mockResolvedValue({ items: [analysis] })
  api.getTextChanges.mockResolvedValue(textList([textItem(3001)]))
  api.getFinancialChanges.mockImplementation((_id: number, sjDiv: 'BS' | 'IS') =>
    Promise.resolve(financialList(sjDiv, sjDiv === 'IS' ? [financialItem()] : [])),
  )
})

afterEach(() => {
  cleanup()
  Object.values(api).forEach((fn) => fn.mockReset())
})

describe('글에 붙인 변경점(#464)', () => {
  it('인용 카드에 변경 유형·섹션 경로·글·보고서 쌍이 보이고, 누르면 결과 화면의 그 문장 변경으로 간다', async () => {
    api.getPosts.mockResolvedValue(list([post(1, { quote: textQuote })]))
    const { container } = renderTab()

    const link = await screen.findByRole('link', { name: /분석 결과에서 보기/ })
    expect(link.getAttribute('href')).toBe('/analyses/42?tab=text&tc=3001')
    expect(within(link).getByText('문장 변경 · 추가')).toBeTruthy()
    expect(within(link).getByText('II. 사업의 내용 > 3. 원재료 및 생산설비')).toBeTruthy()
    expect(within(link).getByText(textQuote.text)).toBeTruthy()
    expect(within(link).getByText('분기보고서 (2025.09) → 분기보고서 (2026.09)')).toBeTruthy()
    expect(await axeViolations(container)).toBe('')
  })

  it('재무 인용은 계정 이름이 보이고 재무 탭의 그 계정으로 간다. 분석 방식이 바뀌었으면 알린다', async () => {
    const financial: PostQuote = {
      ...textQuote,
      kind: 'FINANCIAL_CHANGE',
      label: '손익계산서 · 매출액',
      text: '이전 1,000,000원 → 현재 1,200,000원, 증감 +200,000원(+20.0%)',
      changeType: null,
      sjDiv: 'IS',
      source: { ...textQuote.source, changeId: 501, sectionNo: null, blockNo: null },
      outdated: true,
    }
    api.getPosts.mockResolvedValue(list([post(1, { quote: financial })]))
    renderTab()

    const link = await screen.findByRole('link', { name: /손익계산서 · 매출액/ })
    expect(link.getAttribute('href')).toBe('/analyses/42?tab=financial&sj=IS&change=501')
    expect(within(link).getByText('재무 계정')).toBeTruthy()
    expect(screen.getByText(/분석 방식이 바뀌어 지금 결과와 다를 수 있어요/)).toBeTruthy()
  })

  it('문장 변경을 골라 붙이면 미리보기가 보이고, 올리면 종류·분석·변경 ID만 보낸다', async () => {
    api.createPost.mockResolvedValue(post(2, { author: { nickname: '나', mine: true }, quote: textQuote }))
    renderTab()
    await screen.findByText('HBM 이야기 1')

    fireEvent.click(screen.getByRole('button', { name: '변경점 붙이기' }))
    const dialog = await screen.findByRole('dialog', { name: '변경점 붙이기' })
    expect(within(dialog).getByRole('combobox', { name: '분석' }).textContent).toContain(
      '분기보고서 (2025.09) → 분기보고서 (2026.09)',
    )
    fireEvent.click(await within(dialog).findByRole('button', { name: /원재료 및 생산설비/ }))

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByText('문장 변경 · 추가')).toBeTruthy()
    fireEvent.change(screen.getByRole('textbox', { name: '글쓰기' }), { target: { value: 'HBM 문장이 새로 들어갔네요.' } })
    fireEvent.click(screen.getByRole('button', { name: '올리기' }))

    await waitFor(() =>
      expect(api.createPost).toHaveBeenCalledWith('00126380', 'HBM 문장이 새로 들어갔네요.', {
        kind: 'TEXT_CHANGE',
        analysisId: 42,
        changeId: 3001,
      } satisfies QuoteRequest),
    )
    // 올린 뒤에는 붙인 변경점을 비우고, 새 글에는 서버가 만든 인용 카드가 보인다
    expect(await screen.findByRole('button', { name: '변경점 붙이기' })).toBeTruthy()
    expect(screen.getByRole('link', { name: /분석 결과에서 보기/ })).toBeTruthy()
  })

  it('재무 계정은 재무제표를 골라 붙이고, 없는 값은 0이 아니라 없음으로 보인다', async () => {
    api.createPost.mockResolvedValue(post(2))
    renderTab()
    await screen.findByText('HBM 이야기 1')

    fireEvent.click(screen.getByRole('button', { name: '변경점 붙이기' }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: '재무 계정' }))
    expect(await within(dialog).findByText('이 재무제표에는 바뀐 계정이 없어요')).toBeTruthy()
    fireEvent.click(within(dialog).getByRole('button', { name: '손익계산서' }))
    const account = await within(dialog).findByRole('button', { name: /매출액/ })
    expect(account.textContent).toContain('이전 1,000,000 → 현재 없음')
    fireEvent.click(account)

    expect(screen.getByText('손익계산서 · 매출액')).toBeTruthy()
    fireEvent.change(screen.getByRole('textbox', { name: '글쓰기' }), { target: { value: '매출 계정' } })
    fireEvent.click(screen.getByRole('button', { name: '올리기' }))
    await waitFor(() =>
      expect(api.createPost).toHaveBeenCalledWith('00126380', '매출 계정', {
        kind: 'FINANCIAL_CHANGE',
        analysisId: 42,
        changeId: 501,
      }),
    )
  })

  it('붙인 변경점을 빼면 인용 없이 올린다', async () => {
    api.createPost.mockResolvedValue(post(2))
    renderTab()
    await screen.findByText('HBM 이야기 1')

    fireEvent.click(screen.getByRole('button', { name: '변경점 붙이기' }))
    fireEvent.click(await within(await screen.findByRole('dialog')).findByRole('button', { name: /원재료 및 생산설비/ }))
    fireEvent.click(screen.getByRole('button', { name: '붙인 변경점 빼기' }))
    fireEvent.change(screen.getByRole('textbox', { name: '글쓰기' }), { target: { value: '의견만' } })
    fireEvent.click(screen.getByRole('button', { name: '올리기' }))

    await waitFor(() => expect(api.createPost).toHaveBeenCalledWith('00126380', '의견만', null))
  })

  it('이 기업의 분석이 없으면 붙일 수 없다고 안내한다', async () => {
    api.listCompanyAnalyses.mockResolvedValue({ items: [] })
    renderTab()
    await screen.findByText('HBM 이야기 1')

    fireEvent.click(screen.getByRole('button', { name: '변경점 붙이기' }))
    expect(await screen.findByText('아직 이 기업의 분석이 없어요')).toBeTruthy()
    expect(api.getTextChanges).not.toHaveBeenCalled()
  })

  it('문장 찾기는 두 글자 이상일 때만 검색어로 보낸다', async () => {
    renderTab()
    await screen.findByText('HBM 이야기 1')
    fireEvent.click(screen.getByRole('button', { name: '변경점 붙이기' }))
    const dialog = await screen.findByRole('dialog')
    await within(dialog).findByRole('button', { name: /원재료 및 생산설비/ })

    fireEvent.change(within(dialog).getByRole('searchbox', { name: '문장 찾기' }), { target: { value: 'H' } })
    fireEvent.change(within(dialog).getByRole('searchbox', { name: '문장 찾기' }), { target: { value: 'HBM' } })
    await waitFor(() =>
      expect(api.getTextChanges).toHaveBeenLastCalledWith(42, expect.objectContaining({ q: 'HBM', sort: 'priority' }), expect.anything()),
    )
    expect(api.getTextChanges.mock.calls.some(([, query]) => query.q === 'H')).toBe(false)
  })
})
