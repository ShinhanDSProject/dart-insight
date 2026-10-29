import { describe, expect, it } from 'vitest'
import {
  compareLink,
  isCurrentRoute,
  loadCurrentCompany,
  nextCurrentCompany,
  parseCurrentCompany,
  saveCurrentCompany,
  sourceLink,
  type CurrentCompany,
} from './currentCompany'

const samsung: CurrentCompany = { corpCode: '00126380', corpName: '삼성전자', stockCode: '005930', analysisId: 42, view: 'analysis' }

function memoryStorage(): Pick<Storage, 'getItem' | 'setItem'> {
  const map = new Map<string, string>()
  return { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => void map.set(k, v) }
}

describe('nextCurrentCompany(#502)', () => {
  it('같은 기업의 기업 화면을 열면 분석과 종목코드를 이어 쓰고, 공시 비교는 기업 화면으로 간다', () => {
    const next = nextCurrentCompany(samsung, { corpCode: '00126380', corpName: '삼성전자' })
    expect(next).toEqual({ ...samsung, view: 'company' })
    expect(compareLink(next)).toBe('/companies/00126380')
    expect(sourceLink(next)).toBe('/analyses/42?tab=source')
  })

  it('다른 기업을 열면 전 기업의 분석과 종목코드를 버린다', () => {
    const next = nextCurrentCompany(samsung, { corpCode: '00164779', corpName: 'SK하이닉스' })
    expect(next).toEqual({ corpCode: '00164779', corpName: 'SK하이닉스', stockCode: null, analysisId: null, view: 'company' })
    expect(sourceLink(next)).toBeNull()
  })

  it('분석 결과를 열면 공시 비교는 그 분석으로, 원문 확인은 원문 탭으로 간다', () => {
    const next = nextCurrentCompany(null, { corpCode: '00126380', corpName: '삼성전자', analysisId: 7 })
    expect(compareLink(next)).toBe('/analyses/7')
    expect(sourceLink(next)).toBe('/analyses/7?tab=source')
  })
})

describe('isCurrentRoute', () => {
  it('같은 기업 화면이나 같은 분석일 때만 지금 화면으로 본다', () => {
    expect(isCurrentRoute(samsung, { corpCode: '00126380' })).toBe(true)
    expect(isCurrentRoute(samsung, { analysisId: '42' })).toBe(true)
    expect(isCurrentRoute(samsung, { corpCode: '00164779' })).toBe(false)
    // 다른 분석의 진행 화면처럼 아직 기록하지 않은 화면
    expect(isCurrentRoute(samsung, { analysisId: '43' })).toBe(false)
    expect(isCurrentRoute(samsung, {})).toBe(false)
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
