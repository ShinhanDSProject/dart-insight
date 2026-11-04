import { describe, expect, it } from 'vitest'
import {
  companyOverviewLink,
  companyLink,
  loadRecentCompanies,
  nextCurrentCompany,
  nextRecentCompanies,
  parseRecentCompanies,
  saveRecentCompanies,
  type CurrentCompany,
} from './currentCompany'

const samsung: CurrentCompany = { corpCode: '00126380', corpName: '삼성전자', stockCode: '005930', analysisId: 42, view: 'analysis' }

function memoryStorage(): Pick<Storage, 'getItem' | 'setItem'> {
  const map = new Map<string, string>()
  return { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => void map.set(k, v) }
}

describe('nextCurrentCompany(#502)', () => {
  it('같은 기업의 기업 화면을 열면 분석과 종목코드를 이어 쓴다', () => {
    const next = nextCurrentCompany(samsung, { corpCode: '00126380', corpName: '삼성전자' })
    expect(next).toEqual({ ...samsung, view: 'company' })
    expect(companyLink(next)).toBe('/analyses/42')
  })

  it('기업 이름은 마지막으로 연 분석이 있으면 그 분석 결과로, 없으면 기업 화면으로 간다', () => {
    expect(companyLink(samsung)).toBe('/analyses/42')
    expect(companyLink({ ...samsung, view: 'company' })).toBe('/analyses/42')
    expect(companyLink({ ...samsung, analysisId: null, view: 'company' })).toBe('/companies/00126380')
  })

  it('다른 기업을 열면 전 기업의 분석과 종목코드를 버린다', () => {
    const next = nextCurrentCompany(samsung, { corpCode: '00164779', corpName: 'SK하이닉스' })
    expect(next).toEqual({ corpCode: '00164779', corpName: 'SK하이닉스', stockCode: null, analysisId: null, view: 'company' })
    expect(companyLink(next)).toBe('/companies/00164779')
  })

  it('분석 결과를 열면 기업 이름은 그 분석으로 가고, 기업 개요 주소는 개요 탭이다', () => {
    const next = nextCurrentCompany(null, { corpCode: '00126380', corpName: '삼성전자', analysisId: 7 })
    expect(companyOverviewLink('00126380')).toBe('/companies/00126380?view=overview')
    expect(companyLink(next)).toBe('/analyses/7')
  })
})

describe('nextRecentCompanies(#652)', () => {
  const hynix: CurrentCompany = { corpCode: '00164779', corpName: 'SK하이닉스', stockCode: '000660', analysisId: null, view: 'company' }
  const names = (list: CurrentCompany[]) => list.map((company) => company.corpName)

  it('새로 연 기업을 맨 앞에 두고 전에 본 기업은 뒤로 밀린다', () => {
    const next = nextRecentCompanies([samsung], { corpCode: '00164779', corpName: 'SK하이닉스' })
    expect(names(next)).toEqual(['SK하이닉스', '삼성전자'])
    expect(companyLink(next[1])).toBe('/analyses/42')
  })

  it('이미 있는 기업을 다시 열면 한 번만 두고 맨 앞으로 옮기며, 그 기업의 분석을 이어 쓴다', () => {
    const next = nextRecentCompanies([hynix, samsung], { corpCode: '00126380', corpName: '삼성전자' })
    expect(names(next)).toEqual(['삼성전자', 'SK하이닉스'])
    expect(next[0]).toEqual({ ...samsung, view: 'company' })
  })

  it('3개를 넘으면 가장 오래된 기업이 빠진다', () => {
    const lg = { corpCode: '00401731', corpName: 'LG전자' }
    const next = nextRecentCompanies([{ ...hynix }, samsung, { ...hynix, corpCode: '1', corpName: '카카오' }], lg)
    expect(names(next)).toEqual(['LG전자', 'SK하이닉스', '삼성전자'])
  })
})

describe('저장', () => {
  it('저장한 목록을 그대로 읽고, 예전 값(기업 하나)도 목록으로 읽는다', () => {
    const storage = memoryStorage()
    expect(saveRecentCompanies(storage, [samsung])).toBe(true)
    expect(loadRecentCompanies(storage)).toEqual([samsung])
    expect(parseRecentCompanies(JSON.stringify(samsung))).toEqual([samsung])
  })

  it('모양이 다르거나 깨진 값은 버린다', () => {
    expect(parseRecentCompanies('{"corpCode":1}')).toEqual([])
    expect(parseRecentCompanies('not json')).toEqual([])
    expect(parseRecentCompanies(null)).toEqual([])
    expect(parseRecentCompanies(`[${JSON.stringify(samsung)}, 3]`)).toEqual([samsung])
    expect(parseRecentCompanies('{"corpCode":"1","corpName":"x","view":"analysis"}')[0]?.view).toBe('company')
  })

  it('저장소가 없으면 읽지도 저장하지도 않는다', () => {
    expect(loadRecentCompanies(null)).toEqual([])
    expect(saveRecentCompanies(null, [samsung])).toBe(false)
  })
})
