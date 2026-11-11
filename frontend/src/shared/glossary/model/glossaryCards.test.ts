import { describe, expect, it } from 'vitest'
import type { GlossaryTerm } from '@/shared/api/glossaryTerms'
import {
  easierQuestion,
  findCardByName,
  normalizeTermName,
  relatedTerms,
  termCardByKey,
  termQuestion,
} from './glossaryCards'

function card(key: string, term: string, extra: Partial<GlossaryTerm> = {}): GlossaryTerm {
  return {
    key,
    level: 'CORE',
    term,
    aliases: [],
    definition: `${term}의 뜻이에요.`,
    example: null,
    whereToCheck: null,
    noJudgment: null,
    related: [],
    sources: [{ title: '공식 자료', url: 'https://example.test' }],
    reviewedAt: '2026-11-10',
    ...extra,
  }
}

const CARDS = [
  card('convertibleBond', '전환사채', { aliases: ['CB'] }),
  card('debtRatio', '부채비율', { aliases: ['부채 비율'], related: ['convertibleBond', 'missing'] }),
  card('rceptNo', '접수번호', { definition: '카드의 접수번호 뜻이에요.' }),
]

describe('normalizeTermName·findCardByName', () => {
  it('공백을 빼고 영문 대소문자를 가리지 않고 용어·별칭으로 카드를 찾는다(backend와 같은 기준)', () => {
    expect(normalizeTermName(' 부채 비율 ')).toBe('부채비율')
    expect(findCardByName(CARDS, 'cb')?.key).toBe('convertibleBond')
    expect(findCardByName(CARDS, '부채비율')?.key).toBe('debtRatio')
    expect(findCardByName(CARDS, '없는 용어')).toBeNull()
    expect(findCardByName(CARDS, ' ')).toBeNull()
  })
})

describe('termCardByKey', () => {
  it('카드가 있으면 그 카드를 쓴다(결과 화면과 채팅 카드의 뜻이 같다, AC10)', () => {
    expect(termCardByKey(CARDS, 'rceptNo')?.definition).toBe('카드의 접수번호 뜻이에요.')
  })

  it('카드를 아직 못 받았거나 그 키의 카드가 없으면 뜻을 지어내지 않고 null이다', () => {
    expect(termCardByKey(CARDS, 'fsDiv')).toBeNull()
    expect(termCardByKey(null, 'rceptNo')).toBeNull()
  })
})

describe('relatedTerms·이어서 묻기', () => {
  it('관련 용어는 목록에 있는 카드의 용어만 순서대로 고르고, 이어서 묻기 요청을 만든다', () => {
    expect(relatedTerms(CARDS, CARDS[1])).toEqual(['전환사채'])
    expect(easierQuestion('부채비율')).toBe('부채비율 더 쉽게 설명해줘')
    expect(termQuestion('전환사채')).toBe('전환사채 뜻 알려줘')
  })
})
