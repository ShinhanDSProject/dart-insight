// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PageSuspense } from './PageSuspense'
import { RouteError } from './RouteError'
import { lazyPage } from './lazyPage'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function renderLazyRoute(load: Parameters<typeof lazyPage>[0]) {
  const Page = lazyPage(load)
  const router = createMemoryRouter([
    { path: '/', element: <PageSuspense><Page /></PageSuspense>, errorElement: <RouteError /> },
  ])
  render(<RouterProvider router={router} />)
}

describe('화면 코드 나눠 불러오기', () => {
  it('화면 코드를 받는 동안 로딩 표시를 보여 주고, 받으면 화면을 그린다', async () => {
    let finish: () => void = () => {}
    const ready = new Promise<void>((resolve) => {
      finish = resolve
    })
    renderLazyRoute(() => ready.then(() => () => <h1>기업 검색</h1>))

    expect((await screen.findByRole('status')).textContent).toContain('화면을 불러오고 있어요')
    finish()
    expect(await screen.findByRole('heading', { name: '기업 검색' })).toBeTruthy()
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('화면 코드를 받지 못하면 오류 화면과 다시 시도 버튼을 보여 준다', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    renderLazyRoute(() => Promise.reject(new TypeError('Failed to fetch dynamically imported module')))

    expect(await screen.findByRole('heading', { name: '화면을 불러오지 못했어요' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeTruthy()
    expect(screen.getByRole('link', { name: '기업 검색으로 돌아가기' }).getAttribute('href')).toBe('/')
  })

  it('화면 코드와 상관없는 오류에는 다시 시도 버튼 없이 기본 오류 화면을 보여 준다', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    function Broken(): never {
      throw new Error('그리기 실패')
    }
    renderLazyRoute(() => Promise.resolve(Broken))

    expect(await screen.findByRole('heading', { name: '화면을 그리지 못했어요' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: '다시 시도' })).toBeNull()
  })
})
