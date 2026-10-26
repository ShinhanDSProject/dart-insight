// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it } from 'vitest'
import { ApiError } from '@/shared/api/client'
import { axeViolations } from '@/test/axe'
import { Badge } from './Badge'
import { Button, ButtonAnchor, ButtonLink } from './Button'
import { Card } from './Card'
import { Chip } from './Chip'
import { CompareBars } from './CompareBars'
import { DartLinkActions, DartLinkInline } from './DartLink'
import { DataTable, DataTableRow, SortableHeader } from './DataTable'
import { Dialog, Kbd } from './Dialog'
import { FieldHint, FieldLabel, Input, Select } from './Field'
import { Icon } from './Icon'
import { Notice } from './Notice'
import { Panel, PanelTitle } from './Panel'
import { SegmentedControl } from './SegmentedControl'
import { ServiceNotice } from './ServiceNotice'
import { ShareBar } from './ShareBar'
import { SidePanel } from './SidePanel'
import { AlertState, EmptyState, ErrorState, LoadingState } from './StateView'
import { Tabs } from './Tabs'

const noop = () => {}
const rceptNo = '20250814000123'
const dartUrl = `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${rceptNo}`

afterEach(cleanup)

async function expectNoViolations(ui: ReactNode) {
  const { container } = render(<MemoryRouter>{ui}</MemoryRouter>)
  expect(await axeViolations(container)).toBe('')
}

describe('공통 UI 접근성(axe)', () => {
  it('버튼의 모든 모양(아이콘 버튼 포함)과 버튼 모양 링크에 위반이 없다', async () => {
    await expectNoViolations(
      <div>
        <Button variant="primary">분석 시작</Button>
        <Button variant="secondary" size="lg">
          검색
        </Button>
        <Button variant="link">모두 지우기</Button>
        <Button variant="secondary" aria-pressed>
          켜짐
        </Button>
        <Button variant="secondary" disabled>
          비활성
        </Button>
        <Button variant="icon" aria-label="닫기">
          <Icon name="x" />
        </Button>
        <ButtonLink to="/companies/00126380">회사 보기</ButtonLink>
        <ButtonAnchor href={dartUrl} target="_blank" rel="noopener noreferrer">
          DART 원문 열기
        </ButtonAnchor>
      </div>,
    )
  })

  it('배지·카드·칩 묶음에 위반이 없다', async () => {
    await expectNoViolations(
      <div>
        <Badge>이전</Badge>
        <Badge tone="accent">AI 생성</Badge>
        <Badge tone="attention">검토 필요</Badge>
        <Card as="article" tone="attention" selected aria-label="변경 카드">
          <p>본문</p>
        </Card>
        <div role="group" aria-label="변경 유형 거르기">
          <Chip pressed count={12}>
            전체
          </Chip>
          <Chip pressed={false} count={null}>
            추가
          </Chip>
          <Chip tone="attention" pressed={false} count={3}>
            검토 필요
          </Chip>
        </div>
      </div>,
    )
  })

  it('세그먼트(aria-label·aria-labelledby)와 탭에 위반이 없다', async () => {
    const options = [
      { value: 'rate', label: '증감률' },
      { value: 'amount', label: '금액' },
    ] as const
    await expectNoViolations(
      <div>
        <SegmentedControl aria-label="차트 보기" options={options} value="rate" onChange={noop} />
        <FieldLabel as="span" id="unit-label">
          단위
        </FieldLabel>
        <SegmentedControl aria-labelledby="unit-label" options={options} value="amount" onChange={noop} disabled />
        <SegmentedControl
          aria-label="화면 테마"
          variant="icon"
          options={[
            { value: 'light', label: '밝게', icon: 'sun' },
            { value: 'dark', label: '어둡게', icon: 'moon' },
          ]}
          value="dark"
          onChange={noop}
        />
        <Tabs
          label="결과 탭"
          items={[
            { value: 'summary', label: '요약' },
            { value: 'financial', label: '재무 수치' },
          ]}
          value="summary"
          onChange={noop}
        />
      </div>,
    )
  })

  it('정렬 머리글이 있는 데이터 표에 위반이 없다', async () => {
    await expectNoViolations(
      <DataTable caption="재무 수치 변화" density="dense" stickyHeader>
        <thead>
          <tr>
            <th scope="col">계정</th>
            <SortableHeader sort="descending" onSort={noop} numeric>
              증감액
            </SortableHeader>
            <SortableHeader sort="none" onSort={noop} numeric>
              증감률
            </SortableHeader>
          </tr>
        </thead>
        <tbody>
          <DataTableRow selected>
            <th scope="row">자산총계</th>
            <td className="num">▲ 1,000</td>
            <td className="num">▲ 10.0%</td>
          </DataTableRow>
          <DataTableRow>
            <th scope="row">부채총계</th>
            <td className="num">▼ 500</td>
            <td className="num">▼ 5.0%</td>
          </DataTableRow>
        </tbody>
      </DataTable>,
    )
  })

  it('안내(모든 톤)와 패널에 위반이 없다', async () => {
    await expectNoViolations(
      <div>
        <Notice title="안내">
          <p>설명</p>
        </Notice>
        <Notice tone="attention" as="p" role="status">
          검토 필요한 항목이 있어요.
        </Notice>
        <Notice tone="blocked" title="비교할 수 없어요" role="alert">
          <p>사유</p>
        </Notice>
        <ServiceNotice />
        <Panel aria-labelledby="panel-title">
          <PanelTitle id="panel-title">요약</PanelTitle>
          <p>내용</p>
        </Panel>
        <Panel as="div" aria-label="보조">
          <PanelTitle as="h3">작은 제목</PanelTitle>
        </Panel>
      </div>,
    )
  })

  it('로딩·빈 결과·오류 상태에 위반이 없다', async () => {
    const error = new ApiError(503, {
      code: 'AI_SERVER_UNAVAILABLE',
      message: 'AI 서버를 쓸 수 없어요.',
      traceId: 'trace-1',
      errors: [],
    })
    await expectNoViolations(
      <div>
        <LoadingState />
        <EmptyState title="결과가 없어요">
          <p>다른 이름으로 찾아보세요.</p>
        </EmptyState>
        <ErrorState error={error} onRetry={noop} />
        <ErrorState error={new Error('x')} />
        <AlertState title="불러오지 못했어요" />
      </div>,
    )
  })

  it('이름이 붙은 입력·선택창에 위반이 없다', async () => {
    await expectNoViolations(
      <form>
        <FieldLabel htmlFor="q">회사명</FieldLabel>
        <FieldHint id="q-hint">2자 이상</FieldHint>
        <Input id="q" aria-describedby="q-hint" invalid />
        <label>
          단위
          <Select defaultValue="MILLION">
            <option value="WON">원</option>
            <option value="MILLION">백만원</option>
          </Select>
        </label>
      </form>,
    )
  })

  it('구성 막대와 비교 막대에 위반이 없다', async () => {
    await expectNoViolations(
      <div>
        <ShareBar
          segments={[
            { label: '추가', value: 3, text: '3', tone: 'added' },
            { label: '수정', value: 5, text: '5', tone: 'modified' },
            { label: '삭제', value: 0, text: '0', tone: 'deleted' },
          ]}
        />
        <CompareBars
          previous={{ label: '이전 · 2024.06.30', value: -120, text: '-120 백만원' }}
          current={{ label: '현재 · 2025.06.30', value: 300, text: '300 백만원' }}
        />
      </div>,
    )
  })

  it('DART 원문 링크(확인됨·확인 안 됨)에 위반이 없다', async () => {
    await expectNoViolations(
      <div>
        <DartLinkActions rceptNo={rceptNo} dartUrl={dartUrl} />
        <DartLinkActions rceptNo={rceptNo} dartUrl={null} />
        <p>
          <DartLinkInline rceptNo={rceptNo} dartUrl={dartUrl} label="현재 반기보고서" />
          <DartLinkInline rceptNo={rceptNo} dartUrl="https://example.com" label="이전 반기보고서" />
        </p>
      </div>,
    )
  })

  it('보조 패널과 대화상자에 위반이 없다', async () => {
    await expectNoViolations(
      <div>
        <SidePanel onClose={noop} aria-labelledby="side-title">
          <h2 id="side-title">수치 근거</h2>
          <p>근거 내용</p>
        </SidePanel>
        <Dialog titleId="dialog-title" title="키보드 단축키" onClose={noop}>
          <p>
            <Kbd>?</Kbd> 도움말 열기
          </p>
        </Dialog>
      </div>,
    )
  })
})
