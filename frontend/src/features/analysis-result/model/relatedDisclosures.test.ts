import { describe, expect, it } from 'vitest'
import type { RelatedDisclosure } from '@/shared/api/textChanges'
import { matchLevelLabel, splitRelated, timingLabel } from './relatedDisclosures'

function item(rceptNo: string, matchLevel: RelatedDisclosure['matchLevel'] = 'TYPE_ONLY'): RelatedDisclosure {
  return {
    rceptNo,
    latestRceptNo: rceptNo,
    reportName: '주요사항보고서(유상증자결정)',
    receivedDate: '2026-03-12',
    disclosureType: 'B001',
    timing: 'DURING',
    matchRule: 'equity-financing',
    matchRuleLabel: '자본 조달',
    matchLevel,
    matchedFields: matchLevel === 'STRONG' ? ['NEW_SHARES'] : [],
    remarks: null,
    dartUrl: `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${rceptNo}`,
  }
}

describe('timingLabel', () => {
  it('보고 기간 안과 기간 뒤를 나눠 적는다', () => {
    expect(timingLabel('DURING')).toBe('보고 기간 중')
    expect(timingLabel('AFTER')).toBe('기간 후~제출 전')
  })
})

describe('matchLevelLabel', () => {
  it('내용 일치는 일치한 값 종류를 함께 적는다', () => {
    expect(matchLevelLabel({ matchLevel: 'STRONG', matchedFields: ['PLAINTIFF', 'CASE_NAME'] })).toBe(
      '내용 일치(원고·사건 명칭)',
    )
  })

  it('일치한 값 종류가 없으면 내용 일치만 적는다', () => {
    expect(matchLevelLabel({ matchLevel: 'STRONG', matchedFields: [] })).toBe('내용 일치')
  })

  it('같은 종류는 값 종류를 적지 않는다', () => {
    expect(matchLevelLabel({ matchLevel: 'TYPE_ONLY', matchedFields: [] })).toBe('같은 종류')
  })
})

describe('splitRelated', () => {
  it('5건 이하면 모두 보이고 접지 않는다', () => {
    const items = [item('1', 'STRONG'), item('2'), item('3'), item('4'), item('5')]
    expect(splitRelated(items)).toEqual({ shown: items, hidden: [] })
  })

  it('5건을 넘으면 앞의 5건만 보이고 나머지 같은 종류를 접는다', () => {
    const items = [item('1', 'STRONG'), item('2'), item('3'), item('4'), item('5'), item('6'), item('7')]
    const { shown, hidden } = splitRelated(items)
    expect(shown.map((i) => i.rceptNo)).toEqual(['1', '2', '3', '4', '5'])
    expect(hidden.map((i) => i.rceptNo)).toEqual(['6', '7'])
  })

  it('내용 일치가 5건을 넘으면 내용 일치는 모두 보인다', () => {
    const strong = ['1', '2', '3', '4', '5', '6'].map((n) => item(n, 'STRONG'))
    const { shown, hidden } = splitRelated([...strong, item('7')])
    expect(shown).toEqual(strong)
    expect(hidden.map((i) => i.rceptNo)).toEqual(['7'])
  })
})
