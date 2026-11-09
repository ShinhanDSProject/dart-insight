import { describe, expect, it } from 'vitest'
import type { ChatCitation } from '@/shared/api/agentChat'
import {
  briefLines,
  chatActionTarget,
  chatContextOf,
  citationChanges,
  citationLabel,
  citationLink,
  citationNote,
  citationTitle,
  crossCheckView,
  parseChatAnswer,
} from './chatLinks'
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

  it('문장 변화로 옮기면 분야 거르기를 지워 접힌 변경도 찾게 한다(3.29, AC6)', () => {
    const target = chatActionTarget({ type: 'OPEN_TAB', label: null, tab: 'text', filters: { q: '소송' } }, [])
    expect(target).toEqual({ kind: 'open', changes: expect.objectContaining({ tq: '소송', tfield: null }) })
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
    })
    expect(chatActionTarget({ type: 'DELETE_POST', label: null }, [])).toEqual({ kind: 'ignore' })
    expect(chatActionTarget({ type: 'OPEN_TAB', label: null, tab: 'ask' }, [])).toEqual({ kind: 'ignore' })
    expect(chatActionTarget({ type: 'OPEN_TEXT_CHANGE', label: null, changeId: '5' }, [])).toEqual({ kind: 'ignore' })
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

describe('채팅 추가 액션(#584)', () => {
  const act = (action: Record<string, unknown>) => chatActionTarget({ label: null, ...action } as never, [financial])

  it('다른 분석 열기와 기업 나란히 보기는 그 화면 링크가 된다(AC27)', () => {
    expect(act({ type: 'OPEN_ANALYSIS', analysisId: 21 })).toEqual({ kind: 'link', to: '/analyses/21' })
    expect(act({ type: 'OPEN_COMPANY_COMPARE', corpCodes: ['00126380', '00164779', '00126380'] })).toEqual({
      kind: 'link',
      to: '/compare/companies?corps=00126380,00164779',
    })
    expect(act({ type: 'OPEN_COMPANY_COMPARE', corpCodes: ['00126380'] })).toEqual({ kind: 'ignore' })
    expect(act({ type: 'OPEN_ANALYSIS', analysisId: '21' })).toEqual({ kind: 'ignore' })
  })

  it('변경 고정은 변경 번호가 있을 때만 버튼이 된다(AC25)', () => {
    expect(act({ type: 'PIN_CHANGE', changeId: 5012 })).toEqual({ kind: 'pin', changeId: 5012 })
    expect(act({ type: 'PIN_CHANGE' })).toEqual({ kind: 'ignore' })
  })

  it('분석 요청 확인은 네 값이 모두 맞을 때만 버튼이 된다(AC18)', () => {
    const request = { corpCode: '00126380', previousRceptNo: '20250814001234', currentRceptNo: '20260814003699', basis: 'YOY' }
    expect(act({ type: 'CONFIRM_REQUEST_ANALYSIS', ...request })).toEqual({ kind: 'request-analysis', request })
    expect(act({ type: 'CONFIRM_REQUEST_ANALYSIS', ...request, basis: 'NEXT' })).toEqual({ kind: 'ignore' })
    expect(act({ type: 'CONFIRM_REQUEST_ANALYSIS', ...request, previousRceptNo: '2025' })).toEqual({ kind: 'ignore' })
  })

  it('글 초안은 본문과 인용 쿼리를 넘기고 재무 인용은 근거 칩의 재무제표를 붙인다(AC26)', () => {
    expect(
      act({ type: 'OPEN_POST_DRAFT', corpCode: '00126380', body: ' 영업이익이 줄었어요. ', quote: { kind: 'FINANCIAL_CHANGE', analysisId: 14, changeId: 31 } }),
    ).toEqual({
      kind: 'post-draft',
      body: '영업이익이 줄었어요.',
      quote: { quoteAnalysis: '14', quoteKind: 'FINANCIAL_CHANGE', quoteChange: '31', quoteSj: 'IS' },
    })
    expect(act({ type: 'OPEN_POST_DRAFT', body: '초안', quote: { kind: 'OTHER', analysisId: 14, changeId: 31 } })).toEqual({
      kind: 'post-draft',
      body: '초안',
      quote: null,
    })
    expect(act({ type: 'OPEN_POST_DRAFT', body: '  ' })).toEqual({ kind: 'ignore' })
  })
})

describe('보고서 값·기업 근거 칩(#584)', () => {
  const value: ChatCitation = {
    no: 1,
    kind: 'REPORT_VALUE',
    evidenceId: '20260814003699#V1',
    reportName: '반기보고서 (2026.06)',
    label: '매출액',
    value: 305400000,
    unit: '백만원',
    dartUrl: 'https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20260814003699',
  }
  const company: ChatCitation = { no: 2, kind: 'COMPANY', evidenceId: 'C00126380', corpCode: '00126380', corpName: '삼성전자', label: '기업 검색', value: '005930' }

  it('이름은 항목·기업 이름이고 값은 API가 준 값과 단위를 그대로 보인다', () => {
    expect(citationLabel(value)).toBe('매출액')
    expect(citationTitle(value)).toBe('반기보고서 (2026.06): 305,400,000 백만원')
    expect(citationLabel(company)).toBe('삼성전자')
    expect(citationTitle(company)).toBe('기업 검색: 005930')
  })

  it('보고서 값은 DART 원문, 기업은 기업 화면으로 열고 DART가 아닌 주소는 열지 않는다', () => {
    expect(citationLink(value)).toEqual({ kind: 'external', href: value.dartUrl })
    expect(citationLink(company)).toEqual({ kind: 'route', to: '/companies/00126380' })
    expect(citationLink({ ...value, dartUrl: 'https://example.com/x' })).toBeNull()
    expect(citationLink(financial)).toBeNull()
  })
})

describe('용어 카드 근거 칩(GLOSSARY, ADR-0061)', () => {
  const card: ChatCitation = {
    no: 1,
    kind: 'GLOSSARY',
    evidenceId: 'GconvertibleBond',
    termKey: 'convertibleBond',
    term: '전환사채',
    definition: '나중에 주식으로 바꿀 수 있는 회사채예요.',
    sources: [{ title: '공식 자료', url: 'https://example.test' }],
  }

  it('이름은 용어, 마우스를 올리면 한 줄 뜻이고 결과 화면 이동·바깥 링크 없이 카드를 펼친다', () => {
    expect(citationLabel(card)).toBe('전환사채')
    expect(citationTitle(card)).toBe('나중에 주식으로 바꿀 수 있는 회사채예요.')
    expect(citationChanges(card)).toBeNull()
    expect(citationLink(card)).toBeNull()
  })
})

describe('crossCheckView', () => {
  it('어긋남은 오류가 아니라 검토해 볼 신호로만 보인다(AC19)', () => {
    expect(crossCheckView({ result: 'POTENTIAL_MISMATCH', reason: '' })).toEqual({ title: '검토해 볼 신호', tone: 'attention' })
    expect(crossCheckView({ result: 'CONSISTENT', reason: '' }).tone).toBe('info')
    expect(crossCheckView({ result: 'INSUFFICIENT_EVIDENCE', reason: '' }).title).toBe('대조할 근거가 부족해요')
    expect(crossCheckView({ result: 'NOT_COMPARABLE', reason: '' }).title).toBe('기준이 달라 대조하지 않았어요')
  })
})

describe('briefLines', () => {
  it('정리 형식 답을 줄로 나누고 빈 줄과 줄 앞의 - 를 뗀다(AC24)', () => {
    expect(briefLines('- 매출이 늘었어요[1]\n\n- 영업이익이 줄었어요[2]\n')).toEqual(['매출이 늘었어요[1]', '영업이익이 줄었어요[2]'])
  })
})
