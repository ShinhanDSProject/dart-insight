import { describe, expect, it } from 'vitest'
import type { SignalTable, TextEventItem, TextEventSentence, TextEventSentenceItem } from '@/shared/api/textEvents'
import { criteriaRows, holdReasonText, judgmentLine, kindBadge, meaningView, rowCountsLabel, signalBadge, signalReasonView } from './eventSignal'

const PATH = 'XI. 그 밖에 투자자 보호를 위하여 필요한 사항 > 3. 제재 등'

const line = (type: TextEventSentenceItem['type'], text: string, evidenceIds: string[] = ['20260814003958#B10']): TextEventSentenceItem => ({
  type,
  text,
  evidence: evidenceIds.map((evidenceId) => ({ evidenceId, sectionPath: PATH })),
})

const sentence = (status: TextEventSentence['status'], items: TextEventSentenceItem[]): TextEventSentence => ({
  status,
  failReason: status === 'GENERATED' ? null : 'INVALID_OUTPUT',
  aiGenerated: status === 'GENERATED',
  items,
  model: status === 'GENERATED' ? 'model' : null,
  promptVersion: null,
  generatedAt: null,
})

function event(overrides: Partial<TextEventItem> = {}): TextEventItem {
  return {
    kind: '제재',
    changeName: '새로 발생',
    signal: 'CAUTION',
    holdReason: null,
    rowCounts: null,
    meaning: null,
    signalReason: null,
    glossary: [],
    quotes: [],
    scaleAmountText: null,
    scaleRatio: null,
    ...overrides,
  } as TextEventItem
}

describe('signalBadge', () => {
  it('신호마다 글자로 구분되는 이름이 있다', () => {
    expect(signalBadge('CAUTION')).toEqual({ label: '주의 신호', tone: 'attention' })
    expect(signalBadge('POSITIVE')).toEqual({ label: '긍정 신호', tone: 'positive' })
    expect(signalBadge('HOLD')).toEqual({ label: '보류', tone: 'neutral' })
  })
})

describe('kindBadge', () => {
  it('기준표 목록의 종류만 배지로 보인다', () => {
    expect(kindBadge(event({ kindCode: 'SANCTION' }))).toBe('제재')
    expect(kindBadge(event({ kind: '그 밖의 사건', kindCode: 'OTHER' }))).toBeNull()
  })
})

describe('holdReasonText', () => {
  it('보류 사유마다 정해진 문구를 보인다(AC14)', () => {
    expect(holdReasonText('NO_CRITERIA')).toBe('판단 기준이 아직 없는 사건이에요.')
    expect(holdReasonText('EVIDENCE_NOT_CONFIRMED')).toBe('근거를 확인하지 못했어요.')
    expect(holdReasonText('MIXED_SIDES')).toBe('좋은 면과 나쁜 면이 함께 있어요.')
    expect(holdReasonText('MIXED_LITIGATION')).toBe('여러 소송의 진행 상황이 섞여 있어요.')
  })
})

describe('judgmentLine', () => {
  it('종류, 변화, 자본총계 대비 비율을 잇는다', () => {
    expect(judgmentLine(event({ scaleRatio: 0.000_7, scaleAmountText: '8,428.1백만원' }))).toBe('제재 · 새로 발생 · 자본총계의 약 0.07%')
  })

  it('비율이 없으면 원문 금액을, 금액도 없으면 모른다고 적는다', () => {
    expect(judgmentLine(event({ scaleAmountText: 'USD 11,800,000' }))).toBe('제재 · 새로 발생 · USD 11,800,000')
    expect(judgmentLine(event())).toBe('제재 · 새로 발생 · 금액 알 수 없음')
  })

  it('변화 이름이 없으면 그 자리를 빼고 잇는다', () => {
    expect(judgmentLine(event({ kind: '그 밖의 사건', changeName: null }))).toBe('그 밖의 사건 · 금액 알 수 없음')
  })
})

describe('rowCountsLabel', () => {
  it('행 비교 건수를 이번엔 없음까지 함께 보인다', () => {
    expect(rowCountsLabel({ changed: 2, added: 3, missing: 11 })).toBe('바뀐 행 2건 · 새 행 3건 · 이번엔 없는 행 11건')
  })
})

describe('meaningView', () => {
  it('AI 문장이면 문장마다 원문 위치를 붙이고 AI 생성으로 표시한다(AC15)', () => {
    const view = meaningView(event({ meaning: sentence('GENERATED', [line('FACT', '과징금이 새로 적혔어요.'), line('ABSENT', '손익 영향은 이 문단에 없어요.')]) }))

    expect(view?.aiGenerated).toBe(true)
    expect(view?.lines.map((l) => l.text)).toEqual(['과징금이 새로 적혔어요.', '손익 영향은 이 문단에 없어요.'])
    expect(view?.lines[0].sources).toEqual([{ evidenceId: '20260814003958#B10', label: PATH, changeId: null }])
    expect(view?.lines[1].scope).toBe(true)
  })

  it('근거가 인용과 같은 블록이면 그 변경의 원문 비교를 열 수 있다', () => {
    const quote = { changeId: 101, purpose: 'CHANGE', side: 'CURRENT', text: '글', evidenceId: '20260814003958#B10', sectionPath: PATH } as const
    const view = meaningView(event({ quotes: [quote], meaning: sentence('GENERATED', [line('FACT', '사실')]) }))

    expect(view?.lines[0].sources[0].changeId).toBe(101)
  })

  it('섹션 경로를 찾지 못한 근거는 근거 ID로 위치를 보인다', () => {
    const view = meaningView(event({ meaning: sentence('GENERATED', [{ type: 'FACT', text: '사실', evidence: [{ evidenceId: '20260814003958#B9', sectionPath: null }] }]) }))

    expect(view?.lines[0].sources[0].label).toBe('20260814003958#B9')
  })

  it('실패하면 AI 문장 없이 용어 풀이만 남긴다(AC16)', () => {
    const glossary = [{ term: '약식명령', meaning: '재판 없이 벌금을 정하는 절차', source: '출처' }]
    const view = meaningView(event({ meaning: sentence('FAILED', []), glossary }))

    expect(view).toEqual({ lines: [], aiGenerated: false, glossary })
  })

  it('실패했고 풀이할 용어도 없으면 칸이 없다', () => {
    expect(meaningView(event({ meaning: sentence('FAILED', []) }))).toBeNull()
    expect(meaningView(event())).toBeNull()
  })
})

describe('signalReasonView', () => {
  it('주의·긍정은 판정 줄과 AI 근거를 보인다(AC17)', () => {
    const view = signalReasonView(event({ signalReason: sentence('GENERATED', [line('REASON', '근거 1'), line('REASON', '근거 2')]) }))

    expect(view.firstLine).toBeNull()
    expect(view.judgment).toBe('제재 · 새로 발생 · 금액 알 수 없음')
    expect(view.lines.map((l) => [l.label, l.text])).toEqual([
      [null, '근거 1'],
      [null, '근거 2'],
    ])
    expect(view.aiGenerated).toBe(true)
    expect(view.fallbackNote).toBe(false)
  })

  it('기준이 없거나 근거를 확인하지 못한 보류는 코드 문구만 보인다(AC14)', () => {
    const view = signalReasonView(event({ signal: 'HOLD', holdReason: 'NO_CRITERIA' }))

    expect(view).toEqual({ firstLine: '판단 기준이 아직 없는 사건이에요.', judgment: null, lines: [], aiGenerated: false, fallbackNote: false, rowCounts: null })
  })

  it('좋은 면과 나쁜 면이 함께인 보류는 코드 첫 줄 아래 좋은 면·나쁜 면을 나눠 보인다(AC18)', () => {
    const view = signalReasonView(event({ signal: 'HOLD', holdReason: 'MIXED_SIDES', signalReason: sentence('GENERATED', [line('GOOD', '자금이 들어와요'), line('BAD', '지분이 줄어요')]) }))

    expect(view.firstLine).toBe('좋은 면과 나쁜 면이 함께 있어요.')
    expect(view.lines.map((l) => [l.label, l.text])).toEqual([
      ['좋은 면', '자금이 들어와요'],
      ['나쁜 면', '지분이 줄어요'],
    ])
  })

  it('섞인 소송은 좋은 면·나쁜 면 없이 판단하지 않은 이유와 행 건수를 보인다(AC19)', () => {
    const view = signalReasonView(event({ kind: '소송', changeName: '진행', signal: 'HOLD', holdReason: 'MIXED_LITIGATION', rowCounts: { changed: 2, added: 3, missing: 11 }, signalReason: sentence('GENERATED', [line('WHY_HOLD', '여러 소송이 섞였어요')]) }))

    expect(view.firstLine).toBe('여러 소송의 진행 상황이 섞여 있어요.')
    expect(view.lines.map((l) => [l.label, l.text])).toEqual([[null, '여러 소송이 섞였어요']])
    expect(view.rowCounts).toBe('바뀐 행 2건 · 새 행 3건 · 이번엔 없는 행 11건')
  })

  it('신호 이유가 실패하면 일반 문구에 일반적인 설명이라는 표시를 붙이고 AI 생성이 아니다(AC20)', () => {
    const view = signalReasonView(event({ signalReason: sentence('FALLBACK', [line('GENERAL', '제재를 받은 것이라 부담이 생길 수 있어요.', [])]) }))

    expect(view.lines.map((l) => [l.text, l.sources])).toEqual([['제재를 받은 것이라 부담이 생길 수 있어요.', []]])
    expect(view.fallbackNote).toBe(true)
    expect(view.aiGenerated).toBe(false)
  })

  it('좋은 면·나쁜 면 보류의 일반 문구는 좋은 면, 나쁜 면 순서로 이름을 붙인다', () => {
    const view = signalReasonView(event({ signal: 'HOLD', holdReason: 'MIXED_SIDES', signalReason: sentence('FALLBACK', [line('GENERAL', '좋은 일반 문구', []), line('GENERAL', '나쁜 일반 문구', [])]) }))

    expect(view.lines.map((l) => l.label)).toEqual(['좋은 면', '나쁜 면'])
  })

  it('섞인 소송의 대체 표시는 일반적인 설명이라는 표시 없이 코드 첫 줄과 행 건수만 보인다(AC20)', () => {
    const view = signalReasonView(event({ signal: 'HOLD', holdReason: 'MIXED_LITIGATION', rowCounts: { changed: 1, added: 0, missing: 2 }, signalReason: sentence('FALLBACK', []) }))

    expect(view.firstLine).toBe('여러 소송의 진행 상황이 섞여 있어요.')
    expect(view.lines).toEqual([])
    expect(view.fallbackNote).toBe(false)
    expect(view.rowCounts).toBe('바뀐 행 1건 · 새 행 0건 · 이번엔 없는 행 2건')
  })
})

describe('criteriaRows', () => {
  const table = {
    version: 'signal-table-2',
    signalNotice: '공시상 신호이며 투자 판단이 아니에요.',
    kinds: [
      {
        code: 'SANCTION',
        name: '제재',
        front: false,
        changes: [
          { code: 'OCCURRED', name: '새로 발생', signal: 'CAUTION', explicitOnly: false, general: null },
          { code: 'CANCELLED', name: '취소', signal: 'POSITIVE', explicitOnly: true, general: null },
        ],
        generalSides: null,
      },
      {
        code: 'RIGHTS_OFFERING',
        name: '유상증자',
        front: false,
        changes: [
          { code: 'DECIDED', name: '결정', signal: 'MIXED', explicitOnly: false, general: null },
          { code: 'WITHDRAWN', name: '철회', signal: null, explicitOnly: true, general: null },
        ],
        generalSides: null,
      },
    ],
    glossary: [],
  } as SignalTable

  it('종류·변화마다 신호를 글자로 보이고 이 사건의 줄을 표시한다', () => {
    expect(criteriaRows(table, { kindCode: 'SANCTION', changeCode: 'CANCELLED' })).toEqual([
      { key: 'SANCTION/OCCURRED', kind: '제재', change: '새로 발생', signal: '주의 신호', current: false },
      { key: 'SANCTION/CANCELLED', kind: '제재', change: '취소', signal: '긍정 신호', current: true },
      { key: 'RIGHTS_OFFERING/DECIDED', kind: '유상증자', change: '결정', signal: '보류 (좋은 면·나쁜 면)', current: false },
      { key: 'RIGHTS_OFFERING/WITHDRAWN', kind: '유상증자', change: '철회', signal: '보류 (기준 없음)', current: false },
    ])
  })
})
