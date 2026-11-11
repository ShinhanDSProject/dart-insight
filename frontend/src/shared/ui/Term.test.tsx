// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getGlossaryTerms, type GlossaryTerm } from '@/shared/api/glossaryTerms'
import { resetGlossaryTermsCache } from '@/shared/glossary/hooks/useGlossaryTerms'
import { axeViolations } from '@/test/axe'
import { Term } from './Term'

vi.mock('@/shared/api/glossaryTerms', () => ({ getGlossaryTerms: vi.fn() }))

const FS_DIV: GlossaryTerm = {
  key: 'fsDiv',
  level: 'BASIC',
  term: '연결 / 별도',
  aliases: [],
  definition: '연결은 모회사와 자회사를 합친 숫자예요.',
  example: null,
  whereToCheck: null,
  noJudgment: null,
  related: [],
  sources: [{ title: '공식 자료', url: 'https://example.test' }],
  reviewedAt: '2026-11-10',
}

beforeEach(() => {
  resetGlossaryTermsCache()
  vi.mocked(getGlossaryTerms).mockResolvedValue({ items: [FS_DIV] })
})

afterEach(cleanup)

async function renderTerm() {
  const view = render(
    <div>
      <p>
        수치 기준: <Term name="fsDiv">연결</Term> 재무제표
      </p>
      <button type="button">다른 버튼</button>
    </div>,
  )
  await screen.findByRole('button', { name: /연결/ })
  return view
}

function termButton() {
  return screen.getByRole('button', { name: /연결/ })
}

describe('Term', () => {
  it('처음에는 닫혀 있고 원래 문구를 그대로 보여 준다', async () => {
    await renderTerm()
    expect(termButton()).toHaveProperty('textContent', '연결ⓘ')
    expect(termButton().getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByRole('tooltip')).toBeNull()
  })

  it('누르면 용어 풀이와 카드의 한 줄 뜻이 열린다', async () => {
    await renderTerm()
    fireEvent.click(termButton())
    const tooltip = screen.getByRole('tooltip')
    expect(termButton().getAttribute('aria-expanded')).toBe('true')
    expect(termButton().getAttribute('aria-controls')).toBe(tooltip.id)
    expect(tooltip.textContent).toContain('용어 풀이')
    expect(tooltip.textContent).toContain(FS_DIV.definition)
  })

  it('다시 누르면 닫힌다', async () => {
    await renderTerm()
    fireEvent.click(termButton())
    fireEvent.click(termButton())
    expect(screen.queryByRole('tooltip')).toBeNull()
  })

  it('Esc를 누르면 닫히고 초점이 용어 버튼으로 돌아온다', async () => {
    await renderTerm()
    termButton().focus()
    fireEvent.click(termButton())
    fireEvent.keyDown(screen.getByRole('tooltip'), { key: 'Escape' })
    expect(screen.queryByRole('tooltip')).toBeNull()
    expect(document.activeElement).toBe(termButton())
  })

  it('바깥을 누르면 닫힌다', async () => {
    await renderTerm()
    fireEvent.click(termButton())
    fireEvent.pointerDown(document.body)
    expect(screen.queryByRole('tooltip')).toBeNull()
  })

  it('안쪽을 누르면 열린 채로 둔다', async () => {
    await renderTerm()
    fireEvent.click(termButton())
    fireEvent.pointerDown(screen.getByRole('tooltip'))
    expect(screen.getByRole('tooltip')).toBeTruthy()
  })

  it('초점이 밖으로 나가면 닫힌다', async () => {
    await renderTerm()
    fireEvent.click(termButton())
    fireEvent.blur(termButton(), { relatedTarget: screen.getByRole('button', { name: '다른 버튼' }) })
    expect(screen.queryByRole('tooltip')).toBeNull()
  })

  it('카드를 못 받았거나 그 키의 카드가 없으면 풀이 버튼 없이 원래 문구만 보인다', async () => {
    vi.mocked(getGlossaryTerms).mockResolvedValue({ items: [] })
    render(
      <p>
        <Term name="fsDiv">연결</Term>
      </p>,
    )
    await vi.waitFor(() => expect(getGlossaryTerms).toHaveBeenCalled())
    await Promise.resolve()
    expect(screen.getByText('연결')).toBeTruthy()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('닫혔을 때와 열렸을 때 모두 접근성 위반이 없다', async () => {
    const { container } = await renderTerm()
    expect(await axeViolations(container)).toBe('')
    fireEvent.click(termButton())
    expect(await axeViolations(container)).toBe('')
  })
})
