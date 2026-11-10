import { describe, expect, it } from 'vitest'
import type { TextEventItem, TextEventList, TextEventSentence } from '@/shared/api/textEvents'
import { eventGlance, glanceTerms, termLinkLabel, termQuestion } from './eventGlance'

function meaning(text: string, evidenceId = 'E1', status: TextEventSentence['status'] = 'GENERATED'): TextEventSentence {
  return {
    status,
    failReason: null,
    aiGenerated: true,
    items: [{ type: 'FACT', text, evidence: [{ evidenceId, sectionPath: 'III. 재무' }] }],
    model: 'm',
    promptVersion: 'p',
    generatedAt: '2026-11-10T00:00:00',
  } as TextEventSentence
}

function event(eventId: number, sentence: TextEventSentence | null, quotes: { changeId: number; evidenceId: string }[] = []): TextEventItem {
  return { eventId, meaning: sentence, quotes } as unknown as TextEventItem
}

const counts: TextEventList['signalCounts'] = [
  { signal: 'CAUTION', eventCount: 0 },
  { signal: 'POSITIVE', eventCount: 2 },
  { signal: 'HOLD', eventCount: 3 },
]

describe('한눈에 보기', () => {
  it('건수 줄은 코드가 센 사건·신호 수이고, 사건이 없으면 null', () => {
    expect(eventGlance({ items: [event(1, null)], signalCounts: counts })?.countLine).toBe(
      '주요 사건 1건을 찾았어요. 긍정 2건, 주의 0건, 보류 3건이에요.',
    )
    expect(eventGlance({ items: [], signalCounts: counts })).toBeNull()
  })

  it('서버 순서 앞에서부터 공시의 의미가 있는 사건의 첫 사실 문장을 3개까지 고른다', () => {
    const items = [
      event(1, meaning('첫째')),
      event(2, null),
      event(3, meaning('실패', 'E1', 'FAILED')),
      event(4, meaning('둘째')),
      event(5, meaning('셋째')),
      event(6, meaning('넷째')),
    ]
    expect(eventGlance({ items, signalCounts: counts })?.lines.map((line) => line.text)).toEqual(['첫째', '둘째', '셋째'])
  })

  it('근거는 문장과 같은 블록을 인용한 변경만이고, 같은 블록 인용이 없으면 다른 인용으로 대신하지 않고 null', () => {
    const cited = [
      { changeId: 10, evidenceId: 'E9' },
      { changeId: 11, evidenceId: 'E1' },
    ]
    const line = (quotes: { changeId: number; evidenceId: string }[]) => eventGlance({ items: [event(1, meaning('문장'), quotes)], signalCounts: counts })?.lines[0]
    expect(line(cited)?.changeId).toBe(11)
    expect(line([{ changeId: 10, evidenceId: 'E9' }])?.changeId).toBeNull()
    expect(line([])?.changeId).toBeNull()
  })

  it('문장에 나오는 어려운 용어마다 문장 순서로 붙이고, 띄어 쓴 용어는 낱말이 떨어져 있어도 찾는다', () => {
    expect(glanceTerms('SK플래닛이 판교사옥 토지 및 건물의 지분(40.2%)을 1,450억 원에 매도했어요.')).toEqual(['지분 매도'])
    expect(glanceTerms('지배기업이 신탁계약으로 취득한 자기주식 중 34,388주를 소각했어요.')).toEqual(['지배기업', '신탁계약', '자기주식 소각'])
    expect(glanceTerms('2026년 4월 30일 처음으로 중간배당을 시행했어요.')).toEqual(['중간배당'])
  })

  it('두 말 용어 안의 한 말 용어는 따로 붙이지 않고, 용어가 없으면 [], 많으면 3개까지', () => {
    expect(glanceTerms('자기주식을 소각했어요.')).toEqual(['자기주식 소각'])
    expect(glanceTerms('자기주식을 보유하고 있어요.')).toEqual(['자기주식'])
    expect(glanceTerms('판교사옥을 팔았어요.')).toEqual([])
    expect(glanceTerms('지배기업과 종속기업이 유상증자와 전환사채를 썼어요.')).toEqual(['지배기업', '종속기업', '유상증자'])
  })

  it('한눈에 보기 줄에 문장의 용어를 담는다', () => {
    const line = eventGlance({ items: [event(1, meaning('중간배당을 시행했어요.'))], signalCounts: counts })?.lines[0]
    expect(line?.terms).toEqual(['중간배당'])
  })

  it('받침에 따라 이란·란, 이·가를 고른다', () => {
    expect(termLinkLabel('중간배당')).toBe('중간배당이란?')
    expect(termLinkLabel('감자')).toBe('감자란?')
    expect(termLinkLabel('지분 매도')).toBe('지분 매도란?')
    expect(termQuestion('자기주식')).toBe('자기주식이 뭐예요?')
    expect(termQuestion('감자')).toBe('감자가 뭐예요?')
  })
})
