// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Analysis } from '@/shared/api/analyses'
import type { ChangeType, TableCell, TextChangeDetail, TextSource } from '@/shared/api/textChanges'
import { AuthContext, type AuthContextValue } from '@/shared/auth/authContext'
import type { LoadState } from '@/shared/hooks/asyncState'
import { axeViolations } from '@/test/axe'
import { TextEvidencePanel } from './TextEvidencePanel'

// 근거 패널은 원문을 불러오는 훅만 바꿔 끼워 고정된 근거를 그린다
const detail = vi.hoisted(() => ({ state: { status: 'loading' } as LoadState<TextChangeDetail> }))
vi.mock('../hooks/useTextChanges', () => ({
  useTextChangeDetail: () => ({ state: detail.state, reload: () => {} }),
}))

afterEach(cleanup)

const analysis = { analysisId: 16 } as Analysis

const anonymousAuth: AuthContextValue = {
  state: { status: 'anonymous' },
  login: vi.fn(),
  logout: vi.fn(),
}

function source(side: 'previous' | 'current', text: string, table: TableCell[][] | null = null): TextSource {
  const rceptNo = side === 'previous' ? '20250314000100' : '20250814000123'
  return {
    rceptNo,
    reportName: side === 'previous' ? '사업보고서 (2024.12)' : '반기보고서 (2025.06)',
    reportType: side === 'previous' ? 'ANNUAL' : 'HALF',
    fiscalYear: 2025,
    periodEnd: side === 'previous' ? '2024-12-31' : '2025-06-30',
    sectionNo: 3,
    sectionPath: 'II. 사업의 내용 > 1. 사업의 개요',
    blockNo: 12,
    evidenceId: `${rceptNo}#B12`,
    blockType: table ? 'TABLE' : 'PARAGRAPH',
    text,
    table,
    blockMatches: true,
    dartUrl: `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${rceptNo}`,
  }
}

function toTable(rows: string[][]): TableCell[][] {
  return rows.map((row, r) =>
    row.map((text, c) => ({
      text,
      header: r === 0 || c === 0,
      colspan: 1,
      rowspan: 1,
    })),
  )
}

// 숫자 12개가 모두 바뀐 긴 문단. 카드 미리보기는 '…'로 잘려 줄을 숨기는 경우다
const previousText = Array.from({ length: 12 }, (_, i) => `${i + 1}번 사업장 직원은 ${100 + i}명`).join(', ') + '입니다.'
const currentText = Array.from({ length: 12 }, (_, i) => `${i + 1}번 사업장 직원은 ${200 + i}명`).join(', ') + '입니다.'

function given(changeType: ChangeType, previous: string, current: string) {
  detail.state = {
    status: 'success',
    data: {
      change: {
        changeId: 31,
        changeNo: 1,
        changeType,
        blockType: 'PARAGRAPH',
        numbersOnly: changeType === 'NUMERIC_UPDATE',
        sectionStatus: 'MODIFIED',
        sectionTitle: '1. 사업의 개요',
        sectionPath: 'II. 사업의 내용 > 1. 사업의 개요',
        previousSectionPath: null,
        previousPreview: `${previous.slice(0, 40)}…`,
        currentPreview: `${current.slice(0, 40)}…`,
        similarity: 0.9,
        reviewReason: null,
        priority: null,
        riskRelated: false,
      },
      previous: source('previous', previous),
      current: source('current', current),
    },
  }
}

function givenTableChange(changeType: ChangeType = 'MODIFIED') {
  const prevTable = toTable([
    ['구분', '기말 잔액'],
    ['단기차입금', '10,000'],
    ['유동성장기부채', '5,000'],
    ['합계', '15,000'],
  ])
  const currTable = toTable([
    ['구분', '기말 잔액'],
    ['단기차입금', '12,000'],
    ['사채', '8,000'],
    ['합계', '20,000'],
  ])
  detail.state = {
    status: 'success',
    data: {
      change: {
        changeId: 44,
        changeNo: 2,
        changeType,
        blockType: 'TABLE',
        numbersOnly: false,
        sectionStatus: 'MODIFIED',
        sectionTitle: '3. 우발부채와 약정사항',
        sectionPath: 'III. 재무에 관한 사항 > 3. 우발부채와 약정사항',
        previousSectionPath: null,
        previousPreview: '단기차입금 10,000',
        currentPreview: '단기차입금 12,000',
        similarity: 0.82,
        reviewReason: changeType === 'REVIEW_NEEDED' ? '표 구조를 짝짓지 못했어요.' : null,
        priority: null,
        riskRelated: true,
      },
      previous: {
        ...source('previous', '표 원문', prevTable),
        sectionPath: 'III. 재무에 관한 사항 > 3. 우발부채와 약정사항',
      },
      current: {
        ...source('current', '표 원문', currTable),
        sectionPath: 'III. 재무에 관한 사항 > 3. 우발부채와 약정사항',
      },
    },
  }
}

function renderPanel(props: { onClose?: () => void; onAsk?: (q: string) => void; asking?: boolean; changeId?: number } = {}) {
  return render(
    <AuthContext.Provider value={anonymousAuth}>
      <MemoryRouter>
        <main>
          <TextEvidencePanel
            analysis={analysis}
            changeId={props.changeId ?? 31}
            onClose={props.onClose ?? (() => {})}
            onOpenSource={() => {}}
            onAsk={props.onAsk}
            asking={props.asking}
          />
        </main>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

describe('TextEvidencePanel 바뀐 숫자', () => {
  it('숫자만 바뀜이면 미리보기가 잘려도 전문으로 바뀐 숫자를 10쌍까지 보이고 나머지는 외 N개로 적는다', () => {
    given('NUMERIC_UPDATE', previousText, currentText)
    renderPanel()
    const list = screen.getByRole('list', { name: '바뀐 숫자' })
    expect(list.textContent).toContain('이전 100명→, 현재 200명')
    expect(list.textContent).toContain('이전 109명→, 현재 209명')
    expect(list.textContent).not.toContain('110명')
    expect(list.textContent).toContain('외 2개')
  })

  it('두 전문의 숫자 개수가 다르면 바뀐 숫자 줄을 숨긴다', () => {
    given('NUMERIC_UPDATE', '직원은 100명, 지점은 3곳입니다.', '직원은 200명입니다.')
    renderPanel()
    expect(screen.queryByRole('list', { name: '바뀐 숫자' })).toBeNull()
  })

  it('숫자만 바뀜이 아니면 숫자가 달라도 바뀐 숫자 줄을 보이지 않는다', () => {
    given('MODIFIED', '직원은 100명입니다.', '직원은 200명으로 늘었습니다.')
    renderPanel()
    expect(screen.queryByRole('list', { name: '바뀐 숫자' })).toBeNull()
  })

  it('바뀐 숫자 줄이 있는 근거 패널에 접근성 위반이 없다', async () => {
    given('NUMERIC_UPDATE', previousText, currentText)
    renderPanel()
    // 창은 body에 띄우므로 body 전체를 검사한다
    expect(await axeViolations(document.body)).toBe('')
  })
})

describe('TextEvidencePanel 원문 비교 창(#507)', () => {
  it('원문 비교 창으로 뜨고, 닫기와 Esc로 닫는다', () => {
    given('NUMERIC_UPDATE', previousText, currentText)
    const onClose = vi.fn()
    renderPanel({ onClose })

    const dialog = screen.getByRole('dialog', { name: '원문 비교' })
    fireEvent.click(within(dialog).getByRole('button', { name: '닫기' }))
    fireEvent.keyDown(dialog, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})

describe('TextEvidencePanel 표 변경 강조와 후속 행동(#524)', () => {
  it('표 변경에서 바뀐 셀을 <mark>로 강조하고 추가·삭제 행 배지와 요약 건수를 표시한다', async () => {
    givenTableChange('MODIFIED')
    const onAsk = vi.fn()
    renderPanel({ changeId: 44, onAsk })

    const dialog = screen.getByRole('dialog', { name: '원문 비교' })
    const marks = dialog.querySelectorAll('mark.text-evidence__changed')
    expect(Array.from(marks, (m) => m.textContent)).toEqual([
      '10,000 (변경됨)',
      '15,000 (변경됨)',
      '12,000 (변경됨)',
      '20,000 (변경됨)',
    ])
    expect(within(dialog).getByText('삭제 행')).toBeTruthy()
    expect(within(dialog).getByText('추가 행')).toBeTruthy()
    expect(within(dialog).getByText(/바뀐 표 칸 2곳 · 추가된 행 1줄 · 삭제된 행 1줄을 표시했어요\./)).toBeTruthy()

    expect(await axeViolations(document.body)).toBe('')
  })

  it('원문 비교 창 안에서 노트에 담기와 AI 질문 버튼을 제공하고 AI 질문을 누르면 창을 닫고 질문을 보낸다', () => {
    givenTableChange('MODIFIED')
    const onClose = vi.fn()
    const onAsk = vi.fn()
    renderPanel({ changeId: 44, onClose, onAsk })

    const dialog = screen.getByRole('dialog', { name: '원문 비교' })
    expect(within(dialog).getByRole('button', { name: '노트에 담기: III. 재무에 관한 사항 > 3. 우발부채와 약정사항' })).toBeTruthy()

    const askButton = within(dialog).getByRole('button', { name: /이 항목 변화 AI에게 묻기/ })
    fireEvent.click(askButton)
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onAsk).toHaveBeenCalledWith("'3. 우발부채와 약정사항'에서 무엇이 바뀌었나요?")
  })

  it('검토 필요 항목에서는 표 변경 강조와 AI 질문 버튼을 두지 않는다', () => {
    givenTableChange('REVIEW_NEEDED')
    const onAsk = vi.fn()
    renderPanel({ changeId: 44, onAsk })

    const dialog = screen.getByRole('dialog', { name: '원문 비교' })
    expect(dialog.querySelectorAll('mark.text-evidence__changed').length).toBe(0)
    expect(within(dialog).queryByRole('button', { name: /이 항목 변화 AI에게 묻기/ })).toBeNull()
  })
})
