import { describe, expect, it } from 'vitest'
import type { QuestionCitation, QuestionFact } from '@/shared/api/questions'
import { factLabel, parseAnswer } from './answerText'

const citation = (no: number) => ({ no, evidenceId: `R#B${no}` }) as QuestionCitation
const fact = (ref: string) => ({ ref, accountName: '매출액' }) as QuestionFact

describe('parseAnswer', () => {
  it('인용 번호와 수치 표시를 조각으로 나눈다', () => {
    expect(parseAnswer('수요가 늘었어요[1]. 매출액이 늘었어요[F1].', [citation(1)], [fact('F1')])).toEqual([
      { kind: 'text', text: '수요가 늘었어요' },
      { kind: 'citation', citation: citation(1) },
      { kind: 'text', text: '. 매출액이 늘었어요' },
      { kind: 'fact', fact: fact('F1') },
      { kind: 'text', text: '.' },
    ])
  })

  it('붙어 있는 인용 여러 개를 각각 나눈다', () => {
    expect(parseAnswer('늘었어요[1][2]', [citation(1), citation(2)], [])).toEqual([
      { kind: 'text', text: '늘었어요' },
      { kind: 'citation', citation: citation(1) },
      { kind: 'citation', citation: citation(2) },
    ])
  })

  it('응답에 없는 번호와 모르는 꼴의 표시는 글 그대로 둔다', () => {
    expect(parseAnswer('가[3] 나[F9] 다[1, 2] 라[x]', [citation(1)], [])).toEqual([
      { kind: 'text', text: '가[3] 나[F9] 다[1, 2] 라[x]' },
    ])
  })

  it('표시가 없으면 글 하나다', () => {
    expect(parseAnswer('설명이에요.', [], [])).toEqual([{ kind: 'text', text: '설명이에요.' }])
  })

  it('빈 답은 조각이 없다', () => {
    expect(parseAnswer('', [], [])).toEqual([])
  })
})

describe('factLabel', () => {
  it('F 번호를 읽기 쉬운 이름으로 바꾼다', () => {
    expect(factLabel('F2')).toBe('수치 2')
    expect(factLabel('X1')).toBe('X1')
  })
})
