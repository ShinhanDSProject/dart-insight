// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { axeViolations } from '@/test/axe'
import type { HeadlineLine } from '../model/summaryHeadline'
import { DELETED_NOTE } from '../model/summaryLabels'
import { SummaryHeadline } from './SummaryHeadline'

afterEach(cleanup)

const lines: HeadlineLine[] = [
  { itemNo: 1, kind: 'FINANCIAL', text: '매출액이 153.7조 원에서 305.4조 원으로 늘었어요(+98.7%).', aiGenerated: false, target: { type: 'FINANCIAL', changeId: 1, sjDiv: 'IS', changeType: null } },
  { itemNo: 2, kind: 'TEXT', text: '단체급식 거래 관련 과징금 처분 내용이 문서에서 빠졌어요.', aiGenerated: true, target: { type: 'TEXT', changeId: 2, sjDiv: null, changeType: 'DELETED' } },
]

describe('SummaryHeadline 삭제 줄 안내(FS-70)', () => {
  it('삭제 줄에만 끝났다는 뜻이 아니라는 안내를 줄 안에 붙인다', async () => {
    const { container } = render(<SummaryHeadline lines={lines} opener={() => () => {}} />)
    const notes = screen.getAllByText(DELETED_NOTE)
    expect(notes).toHaveLength(1)
    expect(notes[0].closest('button')?.textContent).toContain('과징금 처분 내용이 문서에서 빠졌어요.')
    expect(await axeViolations(container)).toBe('')
  })
})
