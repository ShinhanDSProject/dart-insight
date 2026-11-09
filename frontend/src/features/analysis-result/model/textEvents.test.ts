import { describe, expect, it } from 'vitest'
import { ApiError } from '@/shared/api/client'
import type { TextEventItem, TextEventList, TextEventQuote, TextEventRun, TextEventUnboundChange } from '@/shared/api/textEvents'
import { eventFieldCounts, eventListOf, eventQuotes, eventRowMeta, eventRunPolling, eventScaleView, eventsMoreLabel, fieldEventLabel, needsEventStart, textEventsView, unboundNote, visibleEvents, visibleUnbound } from './textEvents'
import type { FieldCell } from './textFields'

const run = (status: TextEventRun['status'], notCreatedReason: TextEventRun['notCreatedReason'] = null) => ({ status, notCreatedReason }) as TextEventRun
const quote = (purpose: TextEventQuote['purpose'], side: TextEventQuote['side'], text: string): TextEventQuote => ({
  changeId: 1,
  purpose,
  side,
  text,
  evidenceId: '20260814003958#B1',
  sectionPath: 'XI. 그 밖에',
})
const event = (eventId: number, fields: TextEventItem['fields']) => ({ eventId, fields }) as TextEventItem
const cell = (state: FieldCell['state']): FieldCell => ({ field: 'LITIGATION', label: '소송·제재', count: state === 'changed' ? 3 : 0, state })

const scale = (overrides: Partial<TextEventItem>) =>
  ({
    scaleAmount: 11_800_000,
    scaleAmountText: 'USD 11,800,000',
    currency: 'USD',
    scaleAmountKrw: 16_300_000_000,
    scaleEvidenceId: '20260814003958#B1576',
    fxSource: 'reference_table',
    fxRateDate: '2025-12-31',
    ...overrides,
  }) as TextEventItem

describe('eventScaleView', () => {
  it('금액을 모르면 줄을 두지 않고 0으로 보이지 않는다', () => {
    expect(eventScaleView(scale({ scaleAmount: null, scaleAmountText: null, currency: null, scaleAmountKrw: null, scaleEvidenceId: null, fxSource: null, fxRateDate: null }))).toBeNull()
  })

  it('원래 금액은 원문 표기 그대로 보이고 근거 ID를 함께 준다', () => {
    const view = eventScaleView(scale({}))
    expect(view?.amount).toBe('USD 11,800,000')
    expect(view?.evidenceId).toBe('20260814003958#B1576')
  })

  it('환율표로 환산한 외화는 한국은행 매매기준율과 기준일을 밝힌다', () => {
    expect(eventScaleView(scale({}))?.converted).toBe('약 163억원 (기준: 한국은행 매매기준율 2025-12-31)')
  })

  it('공시 글의 환율로 환산한 외화는 한국은행 기준이라고 쓰지 않는다', () => {
    expect(eventScaleView(scale({ fxSource: 'disclosed_rate', fxRateDate: null }))?.converted).toBe('약 163억원 (기준: 이 공시에 적힌 환율)')
  })

  it('환율이 없으면 원래 금액만 보인다', () => {
    const view = eventScaleView(scale({ fxSource: 'none', scaleAmountKrw: null, fxRateDate: null }))
    expect(view?.amount).toBe('USD 11,800,000')
    expect(view?.converted).toBeNull()
  })

  it('환산액이 없으면 약 0원으로 보이지 않는다', () => {
    expect(eventScaleView(scale({ scaleAmountKrw: null }))?.converted).toBeNull()
  })

  it('환율표 기준일을 모르면 기준을 밝힐 수 없어 환산액을 보이지 않는다', () => {
    expect(eventScaleView(scale({ fxRateDate: null }))?.converted).toBeNull()
  })

  it('근거 위치가 없으면 근거 ID도 null이다', () => {
    expect(eventScaleView(scale({ scaleEvidenceId: null }))?.evidenceId).toBeNull()
  })

  it('원화 금액에는 환산 줄이 없다', () => {
    const view = eventScaleView(scale({ scaleAmount: 8_428_100_000, scaleAmountText: '8,428.1백만원', currency: 'KRW', scaleAmountKrw: 8_428_100_000, fxSource: null, fxRateDate: null }))
    expect(view?.amount).toBe('8,428.1백만원')
    expect(view?.converted).toBeNull()
  })
})

describe('needsEventStart', () => {
  it('실행이 없으면 시작한다', () => {
    expect(needsEventStart(run('NOT_STARTED'))).toBe(true)
  })

  it('fake 모델이라 만들지 않았던 분석은 다시 시작한다', () => {
    expect(needsEventStart(run('NOT_CREATED', 'FAKE_MODEL'))).toBe(true)
  })

  it('실패한 실행은 자동으로 다시 시작하지 않는다(ADR-0050)', () => {
    expect(needsEventStart(run('FAILED'))).toBe(false)
  })

  it('진행 중·완료, 그 밖의 사유로 만들지 않은 분석은 시작하지 않는다', () => {
    expect(needsEventStart(run('RUNNING'))).toBe(false)
    expect(needsEventStart(run('COMPLETED'))).toBe(false)
    expect(needsEventStart(run('NOT_CREATED', 'DISABLED'))).toBe(false)
    expect(needsEventStart(run('NOT_CREATED', 'OLD_ANALYSIS'))).toBe(false)
    expect(needsEventStart(run('NOT_CREATED', 'NO_CANDIDATES'))).toBe(false)
  })
})

describe('eventRunPolling', () => {
  it('만드는 중일 때만 다시 묻는다', () => {
    expect(eventRunPolling.shouldContinue(run('PENDING'))).toBe(true)
    expect(eventRunPolling.shouldContinue(run('RUNNING'))).toBe(true)
    expect(eventRunPolling.shouldContinue(run('COMPLETED'))).toBe(false)
    expect(eventRunPolling.shouldContinue(run('FAILED'))).toBe(false)
    expect(eventRunPolling.shouldContinue(run('NOT_CREATED', 'FAKE_MODEL'))).toBe(false)
  })

  it('4xx는 바로 멈추고 그 밖의 오류는 다시 묻는다', () => {
    expect(eventRunPolling.isFatal(new ApiError(409, { code: 'ANALYSIS_NOT_READY', message: '', traceId: '', errors: [] }))).toBe(true)
    expect(eventRunPolling.isFatal(new ApiError(500, { code: 'COMMON_INTERNAL_ERROR', message: '', traceId: '', errors: [] }))).toBe(false)
    expect(eventRunPolling.isFatal(new Error('네트워크'))).toBe(false)
  })
})

describe('eventQuotes', () => {
  it('바뀐 내용은 이전·이번으로 나누고 이유는 어느 쪽이든 한 칸에 모은다', () => {
    const quotes = [quote('CHANGE', 'PREVIOUS', '이전'), quote('CHANGE', 'CURRENT', '이번'), quote('REASON', 'CURRENT', '이유1'), quote('REASON', 'PREVIOUS', '이유2')]

    const grouped = eventQuotes({ quotes } as TextEventItem)

    expect(grouped.previous.map((q) => q.text)).toEqual(['이전'])
    expect(grouped.current.map((q) => q.text)).toEqual(['이번'])
    expect(grouped.reasons.map((q) => q.text)).toEqual(['이유1', '이유2'])
  })
})

describe('fieldEventLabel', () => {
  const counts = eventFieldCounts({ fieldCounts: [{ field: 'LITIGATION', eventCount: 2 }] } as TextEventList)

  it('칸의 관련 사건 수를 칩 뒤에 붙일 말로 보인다(3.58)', () => {
    expect(fieldEventLabel(cell('changed'), counts)).toBe('사건 2')
  })

  it('사건이 없는 칸에는 붙이지 않는다(3.58 AC16)', () => {
    expect(fieldEventLabel({ ...cell('changed'), field: 'DIVIDEND' }, counts)).toBeNull()
  })

  it('사건을 받지 못했으면 그 줄이 빠진다', () => {
    expect(eventFieldCounts(null)).toBeNull()
    expect(fieldEventLabel(cell('changed'), null)).toBeNull()
  })

  it('변경이 없는 칸에는 줄을 두지 않는다', () => {
    expect(fieldEventLabel(cell('no-change'), counts)).toBeNull()
    expect(fieldEventLabel(cell('no-section'), counts)).toBeNull()
  })
})

describe('visibleEvents', () => {
  const items = [event(1, ['LITIGATION']), event(2, ['FUNDING', 'BUSINESS'])]

  it('거르지 않으면 받은 순서대로 모두 보인다', () => {
    expect(visibleEvents(items, null).map((i) => i.eventId)).toEqual([1, 2])
  })

  it('분야를 고르면 그 칸에 세어진 사건만 보인다', () => {
    expect(visibleEvents(items, 'BUSINESS').map((i) => i.eventId)).toEqual([2])
  })
})

describe('textEventsView', () => {
  const received = (data: TextEventRun) => ({ status: 'success', data, failures: 0 }) as const
  const idle = { status: 'idle' } as const
  const stored = (items: unknown[], unboundChanges: unknown[]) => ({ items, unboundChanges }) as unknown as TextEventList

  it('상태를 아직 모르면 아무것도 보이지 않는다', () => {
    expect(textEventsView({ status: 'loading', failures: 0 }, idle)).toEqual({ status: 'hidden' })
  })

  it('만드는 중이면 진행 표시다(AC33)', () => {
    expect(textEventsView(received(run('PENDING')), idle)).toEqual({ status: 'building' })
    expect(textEventsView(received(run('RUNNING')), idle)).toEqual({ status: 'building' })
  })

  it('실패한 실행은 다시 시작할 수 있는지에 따라 다시 시도를 정한다(AC21)', () => {
    expect(textEventsView(received({ ...run('FAILED'), canRetry: true }), idle)).toEqual({ status: 'unavailable', retry: 'available' })
    expect(textEventsView(received({ ...run('FAILED'), canRetry: false }), idle)).toEqual({ status: 'unavailable', retry: 'limited' })
  })

  it('fake 모델은 다시 시도해도 같으므로 다시 시도가 없다(AC21)', () => {
    expect(textEventsView(received(run('NOT_CREATED', 'FAKE_MODEL')), idle)).toEqual({ status: 'unavailable', retry: 'none' })
  })

  it('상태 조회 실패는 다시 시도할 수 있다', () => {
    expect(textEventsView({ status: 'error', error: new Error('실패'), data: null }, idle)).toEqual({ status: 'unavailable', retry: 'available' })
  })

  it('만드는 중에 상태 조회가 멈추면 진행 표시를 남기지 않는다', () => {
    expect(textEventsView({ status: 'error', error: new Error('실패'), data: run('RUNNING') }, idle)).toEqual({ status: 'unavailable', retry: 'available' })
  })

  it('꺼 둔 기능, 옛 분석, 문장 비교 실패는 사건 자리를 두지 않는다', () => {
    for (const reason of ['DISABLED', 'OLD_ANALYSIS', 'TEXT_COMPARE_FAILED'] as const) {
      expect(textEventsView(received(run('NOT_CREATED', reason)), idle)).toEqual({ status: 'hidden' })
    }
  })

  it('후보가 없으면 묶은 사건이 없다는 안내다', () => {
    expect(textEventsView(received(run('NOT_CREATED', 'NO_CANDIDATES')), idle)).toEqual({ status: 'empty' })
  })

  it('끝났으면 사건을 받는 동안 불러오는 중이고, 받으면 사건을 내준다', () => {
    const list = stored([{}], [])
    expect(textEventsView(received(run('COMPLETED')), { status: 'loading' })).toEqual({ status: 'loading' })
    expect(textEventsView(received(run('COMPLETED')), { status: 'success', data: list })).toEqual({ status: 'ready', list })
  })

  it('사건 없이 묶이지 않은 변경만 있어도 내준다(AC22)', () => {
    const list = stored([], [{}])
    expect(textEventsView(received(run('COMPLETED')), { status: 'success', data: list })).toEqual({ status: 'ready', list })
  })

  it('끝났는데 사건도 묶이지 않은 변경도 없으면 묶은 사건이 없다는 안내다', () => {
    expect(textEventsView(received(run('COMPLETED')), { status: 'success', data: stored([], []) })).toEqual({ status: 'empty' })
  })

  it('끝난 실행의 사건을 받지 못하면 성공처럼 보이지 않는다', () => {
    expect(textEventsView(received(run('COMPLETED')), { status: 'error', error: new Error('실패') })).toEqual({ status: 'unavailable', retry: 'available' })
  })
})

describe('eventListOf', () => {
  it('사건을 받았을 때만 목록을 내준다', () => {
    const list = { items: [] } as unknown as TextEventList
    expect(eventListOf({ status: 'ready', list })).toBe(list)
    expect(eventListOf({ status: 'unavailable', retry: 'none' })).toBeNull()
  })
})

describe('unboundNote', () => {
  it('들지 않은 후보 건수를 전체 변경으로 안내한다', () => {
    expect(unboundNote(3)).toBe('사건에 들지 않은 후보 3건은 아래 전체 변경에서 볼 수 있어요.')
    expect(unboundNote(1200)).toBe('사건에 들지 않은 후보 1,200건은 아래 전체 변경에서 볼 수 있어요.')
  })
})

describe('visibleUnbound', () => {
  const changes = [{ changeId: 1, field: 'LITIGATION' }, { changeId: 2, field: 'CONTRACT' }, { changeId: 3, field: null }] as TextEventUnboundChange[]

  it('거르지 않으면 모두 보인다', () => {
    expect(visibleUnbound(changes, null)).toEqual(changes)
  })

  it('분야를 고르면 그 칸의 변경만 보인다', () => {
    expect(visibleUnbound(changes, 'CONTRACT').map((c) => c.changeId)).toEqual([2])
  })
})

describe('eventRowMeta', () => {
  it('사건 한 줄에 종류 · 규모 · AI 생성을 붙인다(3.58)', () => {
    expect(eventRowMeta({ ...scale({}), kind: '제재', kindCode: 'SANCTION' })).toBe('제재 · USD 11,800,000 · AI 생성')
  })

  it('목록 밖 종류와 모르는 규모는 빼고 AI 생성은 늘 붙인다', () => {
    const none = scale({ scaleAmount: null, scaleAmountText: null, currency: null, scaleAmountKrw: null, scaleEvidenceId: null, fxSource: null, fxRateDate: null })
    expect(eventRowMeta({ ...none, kind: '그 밖의 사건', kindCode: 'OTHER' })).toBe('AI 생성')
  })
})

describe('eventsMoreLabel', () => {
  it('숨긴 사건 수로 더 보기 이름을 만든다', () => {
    expect(eventsMoreLabel(2)).toBe('사건 2건 더 보기')
  })
})
