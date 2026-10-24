import { describe, expect, it } from 'vitest'
import {
  financialParamChanges,
  openChangedAccounts,
  openFinancialChanges,
  openSourceChanges,
  openTextChanges,
  openAsk,
  openTextList,
  openTextSearch,
  parseResultParams,
  resultTabs,
  sourceParamChanges,
  textParamChanges,
} from './resultParams'
import { shortcutResultTabs } from '@/shared/lib/shortcuts'

describe('parseResultParams', () => {
  it('값이 없으면 기본값으로 읽는다', () => {
    expect(parseResultParams(new URLSearchParams())).toEqual({
      tab: 'summary',
      sjDiv: 'BS',
      changedOnly: false,
      unit: 'MILLION',
      selectedChangeId: null,
      accountQuery: null,
      textType: null,
      textSort: 'priority',
      textSection: null,
      textQuery: null,
      textPinned: false,
      selectedTextChangeId: null,
      sourceSide: 'current',
      sourceSection: null,
      sourceBlock: null,
    })
  })

  it('주소에 남긴 고르기를 읽는다', () => {
    const params = new URLSearchParams('tab=text&sj=CF&changed=1&change=7&ttype=ADDED&tsort=document&tc=3&doc=previous&section=2&block=5')
    expect(parseResultParams(params)).toMatchObject({
      tab: 'text',
      sjDiv: 'CF',
      changedOnly: true,
      selectedChangeId: 7,
      textType: 'ADDED',
      textSort: 'document',
      selectedTextChangeId: 3,
      sourceSide: 'previous',
      sourceSection: 2,
      sourceBlock: 5,
    })
  })

  it('문장 변화의 섹션과 검색어를 읽고 짧은 검색어는 버린다', () => {
    const params = new URLSearchParams({ tsec: 'II. 사업의 내용', tq: ' 소송 ' })
    expect(parseResultParams(params)).toMatchObject({ textSection: 'II. 사업의 내용', textQuery: '소송' })
    expect(parseResultParams(new URLSearchParams('tsec=%20&tq=가'))).toMatchObject({ textSection: null, textQuery: null })
  })

  it('계정 찾기 검색어를 앞뒤 공백 없이 읽고 공백뿐이면 버린다', () => {
    expect(parseResultParams(new URLSearchParams({ fq: ' 차입금 ' })).accountQuery).toBe('차입금')
    expect(parseResultParams(new URLSearchParams('fq=%20%20')).accountQuery).toBeNull()
  })

  it('모르는 탭·재무제표·유형과 잘못된 번호는 기본값으로 본다', () => {
    const params = new URLSearchParams('tab=x&sj=XX&ttype=NOPE&change=0&tc=-1&section=1.5')
    expect(parseResultParams(params)).toMatchObject({
      tab: 'summary',
      sjDiv: 'BS',
      textType: null,
      selectedChangeId: null,
      selectedTextChangeId: null,
      sourceSection: null,
    })
  })
})

describe('고르기를 주소 값으로 바꾸기', () => {
  it('재무제표를 바꾸면 보던 근거를 닫는다', () => {
    expect(financialParamChanges({ sj: 'IS' })).toEqual({ sj: 'IS', change: null })
    expect(financialParamChanges({ change: 4 })).toEqual({ change: '4' })
    expect(financialParamChanges({ changed: false, unit: 'MILLION' })).toEqual({ changed: null, unit: 'MILLION' })
  })

  it('계정 찾기 검색어를 fq로 남기고 지우면 주소에서 뺀다', () => {
    expect(financialParamChanges({ q: '차입금' })).toEqual({ fq: '차입금' })
    expect(financialParamChanges({ q: null })).toEqual({ fq: null })
  })

  it('재무제표를 바꿔도 계정 찾기 검색어는 그대로 둔다', () => {
    expect(financialParamChanges({ sj: 'CF' })).not.toHaveProperty('fq')
  })

  it('문장 변화의 거르기·정렬을 바꾸면 보던 근거를 닫고 기본 정렬은 주소에서 지운다', () => {
    expect(textParamChanges({ type: 'DELETED' })).toEqual({ ttype: 'DELETED', tpin: null, tc: null })
    expect(textParamChanges({ sort: 'priority' })).toEqual({ tsort: null, tc: null })
    expect(textParamChanges({ change: null })).toEqual({ tc: null })
  })

  it('섹션·검색어를 바꾸면 보던 근거를 닫고 지우면 주소에서 뺀다', () => {
    expect(textParamChanges({ section: 'II. 사업의 내용' })).toEqual({ tsec: 'II. 사업의 내용', tpin: null, tc: null })
    expect(textParamChanges({ q: '소송' })).toEqual({ tq: '소송', tpin: null, tc: null })
    expect(textParamChanges({ type: null, section: null, q: null })).toEqual({ ttype: null, tsec: null, tq: null, tpin: null, tc: null })
  })

  it('고정만 보기를 켜면 유형·섹션·검색어와 보던 근거를 지우고, 끄면 주소에서 뺀다', () => {
    expect(textParamChanges({ pinned: true })).toEqual({ tpin: '1', ttype: null, tsec: null, tq: null, tc: null })
    expect(textParamChanges({ pinned: false })).toEqual({ tpin: null, tc: null })
  })

  it('주소의 tpin=1만 고정만 보기로 읽는다', () => {
    expect(parseResultParams(new URLSearchParams('tpin=1')).textPinned).toBe(true)
    expect(parseResultParams(new URLSearchParams('tpin=yes')).textPinned).toBe(false)
  })

  it('원문 확인의 보고서·항목·위치를 주소 값으로 바꾼다', () => {
    expect(sourceParamChanges({ side: 'previous', section: null, block: null })).toEqual({
      doc: 'previous',
      section: null,
      block: null,
    })
  })

  it('다른 탭의 근거로 옮겨 간다', () => {
    expect(openSourceChanges({ side: 'current', section: 3, block: null })).toEqual({
      tab: 'source',
      doc: 'current',
      section: '3',
      block: null,
    })
    expect(openFinancialChanges('CF', 9)).toEqual({ tab: 'financial', sj: 'CF', change: '9', changed: null, fq: null })
    expect(openTextChanges(2)).toEqual({ tab: 'text', ttype: null, tsort: null, tsec: null, tq: null, tpin: null, tc: '2' })
  })

  it('변화 개요에서 재무 수치 탭을 변경 항목만으로 연다', () => {
    expect(openChangedAccounts('IS')).toEqual({ tab: 'financial', sj: 'IS', changed: '1', change: null, fq: null })
    expect(openChangedAccounts(null)).toEqual({ tab: 'financial', changed: '1', change: null, fq: null })
  })

  it('변화 개요에서 문장 변화 탭을 전체 또는 그 유형으로 연다', () => {
    expect(openTextList(null)).toEqual({ tab: 'text', ttype: null, tsort: null, tpin: null, tc: null })
    expect(openTextList('REVIEW_NEEDED')).toEqual({ tab: 'text', ttype: 'REVIEW_NEEDED', tsort: null, tpin: null, tc: null })
  })
})

describe('AI 질문 탭 주소', () => {
  it('?tab=ask를 AI 질문 탭으로 읽는다', () => {
    expect(parseResultParams(new URLSearchParams('tab=ask')).tab).toBe('ask')
    expect(openAsk()).toEqual({ tab: 'ask' })
  })

  it('찾지 못한 질문은 문장 변화 탭을 그 낱말로 검색해 연다', () => {
    expect(openTextSearch('매출액')).toEqual({ tab: 'text', ttype: null, tsort: null, tsec: null, tq: '매출액', tpin: null, tc: null })
    expect(openTextSearch(null)).toMatchObject({ tab: 'text', tq: null })
  })
})

describe('단축키 탭 순서', () => {
  it('1~5 단축키의 탭 순서가 결과 화면의 탭 순서와 같다', () => {
    expect([...shortcutResultTabs]).toEqual(resultTabs)
  })
})
