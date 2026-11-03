import { describe, expect, it } from 'vitest'
import {
  companyOverviewLink,
  companyLink,
  loadCurrentCompany,
  nextCurrentCompany,
  parseCurrentCompany,
  saveCurrentCompany,
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

describe('저장', () => {
  it('저장한 값을 그대로 읽는다', () => {
    const storage = memoryStorage()
    expect(saveCurrentCompany(storage, samsung)).toBe(true)
    expect(loadCurrentCompany(storage)).toEqual(samsung)
  })

  it('모양이 다르거나 깨진 값은 없는 것으로 본다', () => {
    expect(parseCurrentCompany('{"corpCode":1}')).toBeNull()
    expect(parseCurrentCompany('not json')).toBeNull()
    expect(parseCurrentCompany(null)).toBeNull()
    expect(parseCurrentCompany('{"corpCode":"1","corpName":"x","view":"analysis"}')?.view).toBe('company')
  })

  it('저장소가 없으면 읽지도 저장하지도 않는다', () => {
    expect(loadCurrentCompany(null)).toBeNull()
    expect(saveCurrentCompany(null, samsung)).toBe(false)
  })
})
