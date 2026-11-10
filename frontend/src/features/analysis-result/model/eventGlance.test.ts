import { describe, expect, it } from 'vitest'
import type { TextEventItem, TextEventList, TextEventSentence } from '@/shared/api/textEvents'
import { eventGlance, termLinkLabel, termQuestion } from './eventGlance'

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

  it('목록 용어가 여럿이면 목록에서 앞선 것 하나만, 없으면 null', () => {
    const term = (text: string) => eventGlance({ items: [event(1, meaning(text))], signalCounts: counts })?.lines[0].term
    expect(term('지배기업이 신탁계약으로 취득한 자기주식을 소각했어요.')).toBe('자기주식')
    expect(term('판교사옥을 매도했어요.')).toBeNull()
  })

  it('받침에 따라 이란·란, 이·가를 고른다', () => {
    expect(termLinkLabel('중간배당')).toBe('중간배당이란?')
    expect(termLinkLabel('감자')).toBe('감자란?')
    expect(termQuestion('자기주식')).toBe('자기주식이 뭐예요?')
    expect(termQuestion('감자')).toBe('감자가 뭐예요?')
  })
})
