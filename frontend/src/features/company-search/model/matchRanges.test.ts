import { describe, expect, it } from 'vitest'
import { isChosungQuery, isStockCodeQuery, matchRanges, nameKey, splitByRanges, stockCodeRanges } from './matchRanges'

describe('nameKey', () => {
  it('공백을 모두 빼고 소문자로 바꾼다', () => {
    expect(nameKey(' 삼성\u3000전자\u00a0 LG ')).toBe('삼성전자lg')
  })
})

describe('isChosungQuery', () => {
  it('공백을 뺀 한글 자음 2자 이상이면 초성 검색어다', () => {
    expect(isChosungQuery('ㅅㅅㅈㅈ')).toBe(true)
    expect(isChosungQuery('ㅅㅅ ㅈㅈ')).toBe(true)
  })

  it('자음 1자, 모음, 다른 글자가 섞인 검색어는 초성 검색어가 아니다', () => {
    expect(isChosungQuery('ㅅ')).toBe(false)
    expect(isChosungQuery('ㅏㅏ')).toBe(false)
    expect(isChosungQuery('lgㅈㅈ')).toBe(false)
    expect(isChosungQuery('삼성')).toBe(false)
  })
})

describe('isStockCodeQuery', () => {
  it('앞뒤 공백을 뺀 숫자 6자리면 종목코드 검색어다', () => {
    expect(isStockCodeQuery(' 005930 ')).toBe(true)
    expect(isStockCodeQuery('00593')).toBe(false)
    expect(isStockCodeQuery('005 930')).toBe(false)
  })
})

describe('matchRanges', () => {
  it('이름 일부가 맞으면 그 글자 범위를 돌려준다', () => {
    expect(matchRanges('삼성전자', '성전')).toEqual([[1, 3]])
  })

  it('검색어의 띄어쓰기를 무시하고 맞춘다', () => {
    expect(matchRanges('삼성전자', '삼성 전자')).toEqual([[0, 4]])
  })

  it('이름에 공백이 있어도 건너서 맞추고 사이 공백까지 한 범위로 강조한다', () => {
    expect(matchRanges('삼성 전자', '삼성전자')).toEqual([[0, 5]])
  })

  it('초성 검색어는 음절마다 초성을 맞춘다', () => {
    expect(matchRanges('삼성전자', 'ㅅㅅㅈㅈ')).toEqual([[0, 4]])
    expect(matchRanges('삼성전자우', 'ㅈㅈ')).toEqual([[2, 4]])
  })

  it('초성 검색에서 한글이 아닌 글자는 그대로 남기고 비교한다', () => {
    expect(matchRanges('LG전자', 'ㅈㅈ')).toEqual([[2, 4]])
  })

  it('영문은 대소문자를 가리지 않는다', () => {
    expect(matchRanges('SK하이닉스', 'sk')).toEqual([[0, 2]])
    expect(matchRanges('naver', 'AVE')).toEqual([[1, 4]])
  })

  it('맞는 곳이 여러 번이면 겹치지 않게 모두 돌려주고 맞닿은 범위는 합친다', () => {
    expect(matchRanges('삼성삼성', '삼성')).toEqual([[0, 4]])
    expect(matchRanges('삼성 삼성', '삼성')).toEqual([
      [0, 2],
      [3, 5],
    ])
  })

  it('맞는 곳이 없으면 빈 배열이다', () => {
    expect(matchRanges('삼성전자', '현대')).toEqual([])
    expect(matchRanges('삼성전자', '   ')).toEqual([])
  })

  it('종목코드 검색어면 이름을 강조하지 않는다', () => {
    expect(matchRanges('삼성전자005930', '005930')).toEqual([])
  })
})

describe('stockCodeRanges', () => {
  it('종목코드 검색어와 같은 종목코드는 전체를 강조한다', () => {
    expect(stockCodeRanges('005930', ' 005930 ')).toEqual([[0, 6]])
  })

  it('이름 검색어거나 다른 종목코드면 강조하지 않는다', () => {
    expect(stockCodeRanges('005930', '삼성')).toEqual([])
    expect(stockCodeRanges('005930', '000660')).toEqual([])
  })
})

describe('splitByRanges', () => {
  it('범위대로 맞는 조각과 아닌 조각으로 나눈다', () => {
    expect(splitByRanges('삼성전자우', [[2, 4]])).toEqual([
      { text: '삼성', match: false },
      { text: '전자', match: true },
      { text: '우', match: false },
    ])
  })

  it('범위가 없으면 한 조각이다', () => {
    expect(splitByRanges('삼성전자', [])).toEqual([{ text: '삼성전자', match: false }])
  })
})
