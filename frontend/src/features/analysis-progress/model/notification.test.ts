import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AnalysisStepView } from '@/shared/api/analyses'
import { browserNotification, decideNotification, permissionState, progressPercent, progressTitle, type NotificationInput } from './notification'

const steps = (states: AnalysisStepView['state'][]): AnalysisStepView[] =>
  (['RECEIVED', 'COMPARING', 'VERIFYING', 'DONE'] as const).map((step, i) => ({
    step,
    label: ['요청 접수', '보고서 비교', '근거 확인', '완료'][i],
    state: states[i],
  }))

const BASE = 'DART Insight'

describe('progressTitle', () => {
  it('진행 중이면 끝난 단계 비율을 제목 앞에 붙인다', () => {
    expect(progressTitle({ status: 'RUNNING', steps: steps(['DONE', 'ACTIVE', 'PENDING', 'PENDING']) }, BASE)).toBe(
      '(진행 중 25%) DART Insight',
    )
    expect(progressTitle({ status: 'PENDING', steps: steps(['ACTIVE', 'PENDING', 'PENDING', 'PENDING']) }, BASE)).toBe(
      '(진행 중 0%) DART Insight',
    )
  })

  it('단계 정보가 없으면 비율 없이 진행 중만 보인다', () => {
    expect(progressTitle({ status: 'RUNNING', steps: [] }, BASE)).toBe('(진행 중) DART Insight')
  })

  it('완료와 실패는 제목 앞에 결과를 적는다', () => {
    expect(progressTitle({ status: 'COMPLETED', steps: steps(['DONE', 'DONE', 'DONE', 'DONE']) }, BASE)).toBe(
      '✓ 분석 완료 · DART Insight',
    )
    expect(progressTitle({ status: 'FAILED', steps: steps(['DONE', 'FAILED', 'PENDING', 'PENDING']) }, BASE)).toBe(
      '분석 실패 · DART Insight',
    )
  })

  it('분석을 아직 못 불러왔으면 원래 제목을 그대로 둔다', () => {
    expect(progressTitle(null, BASE)).toBe(BASE)
  })
})

describe('progressPercent', () => {
  it('끝난 단계 수를 반올림한 백분율로 바꾼다', () => {
    expect(progressPercent(steps(['DONE', 'DONE', 'DONE', 'ACTIVE']))).toBe(75)
    expect(progressPercent(steps(['DONE', 'DONE', 'DONE', 'DONE']))).toBe(100)
    expect(progressPercent([])).toBeNull()
  })
})

describe('permissionState', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('브라우저의 Notification 권한을 읽는다', () => {
    vi.stubGlobal('Notification', Object.assign(function Notification() {}, { permission: 'denied' }))
    expect(permissionState(browserNotification())).toBe('denied')
    vi.stubGlobal('Notification', undefined)
    expect(permissionState(browserNotification())).toBe('unsupported')
  })

  it('Notification이 없으면 미지원으로 본다', () => {
    expect(permissionState(undefined)).toBe('unsupported')
  })

  it('브라우저 권한 값을 그대로 옮기고 모르는 값은 아직 묻지 않은 것으로 본다', () => {
    expect(permissionState({ permission: 'granted' })).toBe('granted')
    expect(permissionState({ permission: 'denied' })).toBe('denied')
    expect(permissionState({ permission: 'default' })).toBe('default')
    expect(permissionState({ permission: 'prompt' })).toBe('default')
  })
})

describe('decideNotification', () => {
  const input = (overrides: Partial<NotificationInput> = {}): NotificationInput => ({
    analysis: { analysisId: 7, status: 'COMPLETED', corpName: '삼성전자' },
    permission: 'granted',
    visibility: 'hidden',
    notifiedIds: new Set(),
    ...overrides,
  })

  it('권한이 있고 탭이 숨겨진 채 완료되면 결과로 가는 알림을 띄운다', () => {
    expect(decideNotification(input())).toEqual({
      type: 'notify',
      title: '분석이 끝났어요',
      body: '삼성전자 보고서 비교 결과를 볼 수 있어요.',
      target: 'result',
    })
  })

  it('실패해도 알리고, 누르면 진행 화면에 머문다', () => {
    const decision = decideNotification(input({ analysis: { analysisId: 7, status: 'FAILED', corpName: '삼성전자' } }))
    expect(decision).toMatchObject({ type: 'notify', title: '분석하지 못했어요', target: 'progress' })
  })

  it('탭을 보고 있으면 알리지 않는다', () => {
    expect(decideNotification(input({ visibility: 'visible' }))).toEqual({ type: 'skip', reason: 'visible' })
  })

  it('같은 분석은 한 번만 알린다', () => {
    expect(decideNotification(input({ notifiedIds: new Set([7]) }))).toEqual({ type: 'skip', reason: 'already-notified' })
    expect(decideNotification(input({ notifiedIds: new Set([8]) })).type).toBe('notify')
  })

  it('권한이 없으면 알리지 않는다', () => {
    for (const permission of ['default', 'denied', 'unsupported'] as const) {
      expect(decideNotification(input({ permission }))).toEqual({ type: 'skip', reason: 'not-granted' })
    }
  })

  it('아직 진행 중이면 알리지 않는다', () => {
    for (const status of ['PENDING', 'RUNNING'] as const) {
      expect(decideNotification(input({ analysis: { analysisId: 7, status, corpName: '삼성전자' } }))).toEqual({
        type: 'skip',
        reason: 'not-finished',
      })
    }
  })
})
