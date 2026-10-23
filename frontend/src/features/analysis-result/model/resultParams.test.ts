import { describe, expect, it } from 'vitest'
import {
  financialParamChanges,
  openChangedAccounts,
  openFinancialChanges,
  openSourceChanges,
  openTextChanges,
  openTextList,
  parseResultParams,
  sourceParamChanges,
  textParamChanges,
} from './resultParams'

describe('parseResultParams', () => {
  it('값이 없으면 기본값으로 읽는다', () => {
    expect(parseResultParams(new URLSearchParams())).toEqual({
      tab: 'summary',
      sjDiv: 'BS',
      changedOnly: false,
      unit: 'MILLION',
      selectedChangeId: null,
      textType: null,
      textSort: 'priority',
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

  it('문장 변화의 거르기·정렬을 바꾸면 보던 근거를 닫고 기본 정렬은 주소에서 지운다', () => {
    expect(textParamChanges({ type: 'DELETED' })).toEqual({ ttype: 'DELETED', tc: null })
    expect(textParamChanges({ sort: 'priority' })).toEqual({ tsort: null, tc: null })
    expect(textParamChanges({ change: null })).toEqual({ tc: null })
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
    expect(openFinancialChanges('CF', 9)).toEqual({ tab: 'financial', sj: 'CF', change: '9', changed: null })
    expect(openTextChanges(2)).toEqual({ tab: 'text', ttype: null, tsort: null, tc: '2' })
  })

  it('변화 개요에서 재무 수치 탭을 변경 항목만으로 연다', () => {
    expect(openChangedAccounts('IS')).toEqual({ tab: 'financial', sj: 'IS', changed: '1', change: null })
    expect(openChangedAccounts(null)).toEqual({ tab: 'financial', changed: '1', change: null })
  })

  it('변화 개요에서 문장 변화 탭을 전체 또는 그 유형으로 연다', () => {
    expect(openTextList(null)).toEqual({ tab: 'text', ttype: null, tsort: null, tc: null })
    expect(openTextList('REVIEW_NEEDED')).toEqual({ tab: 'text', ttype: 'REVIEW_NEEDED', tsort: null, tc: null })
  })
})
