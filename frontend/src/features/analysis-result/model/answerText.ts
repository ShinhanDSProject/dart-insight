import type { QuestionCitation, QuestionFact } from '@/shared/api/questions'

/**
 * AI 답 문장을 글·인용·수치 조각으로 나눈다(3.10). `[1]`은 citations[].no, `[F1]`은 facts[].ref를 가리킨다.
 * 응답에 없는 번호나 모르는 꼴의 표시는 근거로 보이지 않고 글 그대로 둔다.
 */
export type AnswerSegment =
  | { kind: 'text'; text: string }
  | { kind: 'citation'; citation: QuestionCitation }
  | { kind: 'fact'; fact: QuestionFact }

const MARKER = /\[([A-Za-z]*\d+)\]/g

export function parseAnswer(answer: string, citations: QuestionCitation[], facts: QuestionFact[]): AnswerSegment[] {
  const byNo = new Map(citations.map((c) => [String(c.no), c]))
  const byRef = new Map(facts.map((f) => [f.ref, f]))
  const segments: AnswerSegment[] = []
  const pushText = (text: string) => {
    if (text === '') return
    const last = segments.at(-1)
    if (last?.kind === 'text') segments[segments.length - 1] = { kind: 'text', text: last.text + text }
    else segments.push({ kind: 'text', text })
  }

  let cursor = 0
  for (const m of answer.matchAll(MARKER)) {
    pushText(answer.slice(cursor, m.index))
    const citation = byNo.get(m[1])
    const fact = byRef.get(m[1])
    if (citation) segments.push({ kind: 'citation', citation })
    else if (fact) segments.push({ kind: 'fact', fact })
    else pushText(m[0])
    cursor = m.index + m[0].length
  }
  pushText(answer.slice(cursor))
  return segments
}

/** 수치 칩에 보이는 짧은 이름(F1 → 수치 1). 모르는 꼴이면 ref 그대로 */
export function factLabel(ref: string): string {
  const n = /^F(\d+)$/.exec(ref)
  return n ? `수치 ${n[1]}` : ref
}
