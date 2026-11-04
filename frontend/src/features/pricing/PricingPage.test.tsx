// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { axeViolations } from '@/test/axe'
import { PricingPage } from './PricingPage'

const post = vi.hoisted(() => vi.fn())
vi.mock('@/shared/api/pricing', () => ({ postPlanInterest: post }))

beforeEach(() => window.localStorage.clear())
afterEach(() => {
  cleanup()
  post.mockReset()
})

function draw() {
  return render(
    <MemoryRouter>
      <main>
        <PricingPage />
      </main>
    </MemoryRouter>,
  )
}

describe('요금제 화면(FS-73)', () => {
  it('요금제 4개·크레딧 소모표·결제 없음 안내를 보인다', async () => {
    const { container } = draw()
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual(
      expect.arrayContaining(['무료', '프로', '팀', '임베드·데이터']),
    )
    expect(screen.getByText('아직 결제는 없어요')).toBeTruthy()
    expect(screen.getByRole('rowheader', { name: '새 비교 계산' })).toBeTruthy()
    expect(await axeViolations(container)).toBe('')
  })

  it('관심 있어요를 누르면 그 요금제를 보내고 기록했어요로 바뀌며, 다시 열어도 다시 보내지 않는다', async () => {
    post.mockResolvedValue(undefined)
    draw()
    const pro = screen.getAllByRole('button', { name: '관심 있어요' })[1]
    fireEvent.click(pro)
    await waitFor(() => expect(screen.getByRole('button', { name: '기록했어요' })).toBeTruthy())
    expect(post).toHaveBeenCalledWith('PRO')
    cleanup()
    draw()
    expect((screen.getByRole('button', { name: '기록했어요' }) as HTMLButtonElement).disabled).toBe(true)
    expect(post).toHaveBeenCalledTimes(1)
  })

  it('기록에 실패하면 다시 시도와 안내를 보인다', async () => {
    post.mockRejectedValue(new Error('network'))
    draw()
    fireEvent.click(screen.getAllByRole('button', { name: '관심 있어요' })[2])
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeTruthy()
  })
})
