import { describe, expect, it } from 'vitest'
import type { ChatCitation } from '@/shared/api/agentChat'
import { chatActionTarget, chatContextOf, citationChanges, citationNote, glossaryEntryOf, parseChatAnswer } from './chatLinks'
import { parseResultParams } from './resultParams'

const params = (query: string) => parseResultParams(new URLSearchParams(query))
const financial: ChatCitation = { no: 2, kind: 'FINANCIAL_CHANGE', evidenceId: 'F31', changeId: 31, sjDiv: 'IS', accountName: '영업이익' }

describe('chatContextOf', () => {
  it('문장 변화·재무·원문 탭은 그 탭에서 고른 변경·위치를 보낸다', () => {
    expect(chatContextOf(params('tab=text&tc=5012&change=31'))).toEqual({ tab: 'text', textChangeId: 5012 })
    expect(chatContextOf(params('tab=financial&change=31&tc=5012'))).toEqual({ tab: 'financial', financialChangeId: 31 })
    expect(chatContextOf(params('tab=source&doc=previous&section=10'))).toEqual({ tab: 'source', side: 'previous', sectionNo: 10 })
  })

  it('명세가 받지 않는 탭(기업 개요·커뮤니티·뉴스)이면 화면 맥락을 보내지 않는다', () => {
    expect(chatContextOf(params('tab=overview'))).toEqual({})
    expect(chatContextOf(params('tab=community'))).toEqual({})
    expect(chatContextOf(params('tab=news'))).toEqual({})
  })
})

describe('citationChanges', () => {
  it('근거 종류마다 그 변경·계정·원문 위치를 연다', () => {
    expect(citationChanges({ no: 1, kind: 'TEXT_CHANGE', evidenceId: 'T5', changeId: 5 })).toMatchObject({ tab: 'text', tc: '5' })
    expect(citationChanges(financial)).toMatchObject({ tab: 'financial', sj: 'IS', change: '31' })
    expect(
      citationChanges({ no: 3, kind: 'BLOCK', evidenceId: 'R#B9', side: 'current', sectionNo: 4, blockNo: 9 }),
    ).toEqual({ tab: 'source', doc: 'current', section: '4', block: '9' })
    expect(citationChanges({ no: 4, kind: 'SECTION', evidenceId: 'R#S4', side: 'previous', sectionNo: 4 })).toEqual({
      tab: 'source',
      doc: 'previous',
      section: '4',
      block: null,
    })
  })

  it('결과 화면에서 열 수 없는 근거(수시공시 등)는 칩만 보인다', () => {
    expect(citationChanges({ no: 5, kind: 'DISCLOSURE', evidenceId: 'D1' })).toBeNull()
  })
})

describe('citationNote', () => {
  it('등급이 없는 문장은 원인 설명처럼 보이지 않게 관련 문장으로 적는다', () => {
    expect(citationNote({ no: 1, kind: 'TEXT_CHANGE', evidenceId: 'T5' })).toBe('관련 문장')
    expect(citationNote({ no: 1, kind: 'BLOCK', evidenceId: 'B', grade: 'STATED' })).toBe('회사 설명')
    expect(citationNote(financial)).toBeNull()
  })
})

describe('chatActionTarget', () => {
  it('문장 변화 탭 열기는 액션의 거르기를 화면 거르기로 옮긴다', () => {
    const target = chatActionTarget(
      { type: 'OPEN_TAB', label: '문장 변화에서 보기', tab: 'text', filters: { q: '소송', risk: true, type: 'ADDED' } },
      [],
    )
    expect(target).toEqual({ kind: 'open', changes: expect.objectContaining({ tab: 'text', tq: '소송', trisk: '1', ttype: 'ADDED' }) })
    const content = chatActionTarget(
      { type: 'OPEN_TAB', label: null, tab: 'text', filters: { type: 'MODIFIED,ADDED,DELETED' } },
      [],
    )
    expect(content).toEqual({ kind: 'open', changes: expect.objectContaining({ ttype: 'CONTENT' }) })
  })

  it('재무 근거 열기는 근거에서 재무제표를 찾아 그 계정을 연다', () => {
    expect(chatActionTarget({ type: 'OPEN_FINANCIAL_CHANGE', label: null, changeId: 31 }, [financial])).toEqual({
      kind: 'open',
      changes: expect.objectContaining({ tab: 'financial', sj: 'IS', change: '31' }),
    })
  })

  it('원문 열기는 문단 번호가 없으면 항목만 연다', () => {
    expect(chatActionTarget({ type: 'OPEN_DOCUMENT', label: null, side: 'current', sectionNo: 10 }, [])).toEqual({
      kind: 'open',
      changes: { tab: 'source', doc: 'current', section: '10', block: null },
    })
  })

  it('노트에 담기 확인은 note를 POST /api/notes 본문으로 옮기고 빈 메모는 null로 둔다', () => {
    expect(
      chatActionTarget(
        { type: 'CONFIRM_SAVE_NOTE', label: '노트에 담기', note: { kind: 'TEXT_CHANGE', analysisId: 42, changeId: 5012, memo: ' ' } },
        [],
      ),
    ).toEqual({ kind: 'save-note', note: { kind: 'TEXT_CHANGE', analysisId: 42, changeId: 5012, memo: null } })
    expect(
      chatActionTarget(
        {
          type: 'CONFIRM_SAVE_NOTE',
          label: null,
          note: { kind: 'ANSWER_CITATION', analysisId: 42, questionId: 7, citationNo: 1, memo: '소송 확인' },
        },
        [],
      ),
    ).toEqual({
      kind: 'save-note',
      note: { kind: 'ANSWER_CITATION', analysisId: 42, questionId: 7, citationNo: 1, memo: '소송 확인' },
    })
  })

  it('노트에 담기 확인은 종류에 필요한 ID가 없거나 메모가 글이 아니면 무시한다', () => {
    const ignored = [
      { kind: 'TEXT_CHANGE', analysisId: 42 },
      { kind: 'ANSWER_CITATION', analysisId: 42, questionId: 7 },
      { kind: 'FINANCIAL_CHANGE', changeId: 31 },
      { kind: 'FINANCIAL_CHANGE', analysisId: 42, changeId: 31, memo: 3 },
      { kind: 'POST', analysisId: 42, changeId: 31 },
    ]
    for (const note of ignored) {
      expect(chatActionTarget({ type: 'CONFIRM_SAVE_NOTE', label: null, note }, [])).toEqual({ kind: 'ignore' })
    }
    expect(chatActionTarget({ type: 'CONFIRM_SAVE_NOTE', label: null }, [])).toEqual({ kind: 'ignore' })
  })

  it('관심 기업 확인은 고유번호 8자리일 때만 버튼이 된다', () => {
    expect(chatActionTarget({ type: 'CONFIRM_FAVORITE', label: '관심 기업에 추가', corpCode: '00126380' }, [])).toEqual({
      kind: 'favorite',
      corpCode: '00126380',
    })
    expect(chatActionTarget({ type: 'CONFIRM_FAVORITE', label: null, corpCode: '005930' }, [])).toEqual({ kind: 'ignore' })
    expect(chatActionTarget({ type: 'CONFIRM_FAVORITE', label: null }, [])).toEqual({ kind: 'ignore' })
  })

  it('용어 사전에 없는 용어는 뜻을 지어내지 않고, 모르는 종류·값이 틀린 액션은 무시한다', () => {
    expect(chatActionTarget({ type: 'OPEN_GLOSSARY', label: null, term: '충당부채' }, [])).toEqual({
      kind: 'glossary',
      term: '충당부채',
      entry: null,
    })
    expect(chatActionTarget({ type: 'DELETE_POST', label: null }, [])).toEqual({ kind: 'ignore' })
    expect(chatActionTarget({ type: 'OPEN_TAB', label: null, tab: 'ask' }, [])).toEqual({ kind: 'ignore' })
    expect(chatActionTarget({ type: 'OPEN_TEXT_CHANGE', label: null, changeId: '5' }, [])).toEqual({ kind: 'ignore' })
  })
})

describe('glossaryEntryOf', () => {
  it('공백을 무시하고 용어 이름이 같은 항목을 찾는다', () => {
    expect(glossaryEntryOf('정정 공시')?.term).toBe('정정공시')
    expect(glossaryEntryOf('없는 용어')).toBeNull()
  })
})

describe('parseChatAnswer', () => {
  it('[1]을 근거 조각으로 나누고 응답에 없는 번호는 글로 둔다', () => {
    expect(parseChatAnswer('줄었어요[2]. 다른 것[9].', [financial])).toEqual([
      { kind: 'text', text: '줄었어요' },
      { kind: 'citation', citation: financial },
      { kind: 'text', text: '. 다른 것[9].' },
    ])
  })
})
