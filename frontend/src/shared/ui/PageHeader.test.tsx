// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { axeViolations } from '@/test/axe'
import { Badge } from './Badge'
import { Card } from './Card'
import { Notice } from './Notice'
import { Page, PageHeader } from './PageHeader'

afterEach(cleanup)

describe('Page·PageHeader(#548)', () => {
  it('브레드크럼·제목·부제·오른쪽 배지를 순서대로 두고, 접근성 위반이 없다', async () => {
    const view = render(
      <Page>
        <PageHeader
          breadcrumb="보고서 선택 / 비교 조건 확인"
          title="비교 대상을 확인하세요"
          titleId="page-title"
          lead="가나전자 · 이전 보고서에서 현재 보고서로 비교해요."
          aside={<Badge tone="accent">분석 준비</Badge>}
        />
      </Page>,
    )
    expect(screen.getByRole('navigation', { name: '현재 위치' }).textContent).toBe('보고서 선택 / 비교 조건 확인')
    const title = screen.getByRole('heading', { level: 1, name: '비교 대상을 확인하세요' })
    expect(title.id).toBe('page-title')
    expect(view.container.querySelector('.page')?.className).toBe('page page--narrow')
    expect(screen.getByText('분석 준비').className).toBe('badge badge--accent')
    expect(await axeViolations(view.container)).toBe('')
  })

  it('넘기지 않은 브레드크럼·부제·오른쪽 묶음은 그리지 않고, 넓은 화면 폭을 고를 수 있다', () => {
    const view = render(
      <Page width="wide" as="div">
        <PageHeader title="두 보고서 사이의 변화" />
      </Page>,
    )
    expect(screen.queryByRole('navigation')).toBeNull()
    expect(view.container.querySelector('.page-header__aside')).toBeNull()
    expect(view.container.querySelector('.page__lead')).toBeNull()
    expect(view.container.querySelector('.page')?.className).toBe('page page--wide')
  })
})

describe('안내 상자·배지·카드 모양(#548)', () => {
  it('제목이 있는 안내 상자는 종류 아이콘(보조기기에는 숨김)과 굵은 제목을 붙이고, 제목이 없으면 글만 둔다', async () => {
    const view = render(
      <>
        <Notice tone="blocked" title="비교 불가 · 같은 보고서를 두 번 선택했어요" role="alert">
          보고서 목록으로 돌아가 다시 선택해 주세요.
        </Notice>
        <Notice as="p" tone="attention" title="기본 비교 기준은 미확정이에요">
          다음 화면에서 확인하세요.
        </Notice>
        <Notice>제목 없는 안내</Notice>
      </>,
    )
    const [blocked, attention, plain] = Array.from(view.container.querySelectorAll('.notice'))
    expect(blocked.className).toBe('notice notice--blocked notice--titled')
    expect(blocked.querySelector('.notice__icon svg')?.getAttribute('aria-hidden')).toBe('true')
    expect(attention.tagName).toBe('P')
    expect(attention.querySelector('.notice__title')?.tagName).toBe('SPAN')
    expect(plain.className).toBe('notice')
    expect(plain.querySelector('.notice__icon')).toBeNull()
    expect(await axeViolations(view.container)).toBe('')
  })

  it('진행할 수 없는 상태 배지와 옅은 바탕 카드를 고를 수 있다', () => {
    render(
      <>
        <Badge tone="danger">비교 불가</Badge>
        <Card tone="subtle">현재 보고서</Card>
      </>,
    )
    expect(screen.getByText('비교 불가').className).toBe('badge badge--danger')
    expect(screen.getByText('현재 보고서').className).toBe('card card--subtle')
  })
})
