// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { RESULT_TOUR_SEEN_KEY } from '@/shared/lib/resultTour'
import { axeViolations } from '@/test/axe'
import { ServiceNoticeDialog } from './ServiceNoticeDialog'

afterEach(() => {
  cleanup()
  window.localStorage.clear()
})

describe('이용 안내 대화상자(#842)', () => {
  it('면책 문구 아래에 화면의 표시 뜻을 두고, 신호·증감은 판단이 아니라고 적는다', async () => {
    const { container } = render(<ServiceNoticeDialog onClose={vi.fn()} />)
    const dialog = within(screen.getByRole('dialog', { name: '이용 안내' }))
    expect(dialog.getByText('투자 조언이 아니며', { exact: false })).toBeTruthy()
    expect(dialog.getByRole('heading', { name: '화면의 표시 뜻' })).toBeTruthy()
    expect(dialog.getByText('AI 생성')).toBeTruthy()
    expect(dialog.getByText(/기준표가 붙인 신호예요\. 투자 판단이나 추천이 아니에요/)).toBeTruthy()
    expect(dialog.getByText(/좋고 나쁨을 뜻하지 않아요/)).toBeTruthy()
    expect(await axeViolations(container)).toBe('')
  })

  it('둘러보기 다시 보기를 누르면 본 표시를 지우고 대화상자를 닫는다', () => {
    window.localStorage.setItem(RESULT_TOUR_SEEN_KEY, '1')
    const onClose = vi.fn()
    render(<ServiceNoticeDialog onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: '결과 화면 둘러보기 다시 보기' }))
    expect(window.localStorage.getItem(RESULT_TOUR_SEEN_KEY)).toBeNull()
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
