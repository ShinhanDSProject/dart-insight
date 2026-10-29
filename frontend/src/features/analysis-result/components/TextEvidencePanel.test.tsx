// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Analysis } from '@/shared/api/analyses'
import type { ChangeType, TextChangeDetail, TextSource } from '@/shared/api/textChanges'
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

function source(side: 'previous' | 'current', text: string): TextSource {
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
    blockType: 'PARAGRAPH',
    text,
    table: null,
    blockMatches: true,
    dartUrl: `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${rceptNo}`,
  }
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

function renderPanel() {
  return render(
    <main>
      <TextEvidencePanel analysis={analysis} changeId={31} onClose={() => {}} onOpenSource={() => {}} />
    </main>,
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
    render(<TextEvidencePanel analysis={analysis} changeId={31} onClose={onClose} onOpenSource={() => {}} />)

    const dialog = screen.getByRole('dialog', { name: '원문 비교' })
    fireEvent.click(within(dialog).getByRole('button', { name: '닫기' }))
    fireEvent.keyDown(dialog, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})
