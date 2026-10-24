import { match } from 'ts-pattern'
import type { DocumentSide } from '@/shared/api/documents'
import type { QuestionAnswer } from '@/shared/api/questions'
import type { AiInfo } from '@/shared/api/summary'
import type { TextExplanation } from '@/shared/api/textChanges'
import { displaySectionPath } from '@/shared/lib/sectionTitle'
import { citationSideLabel, quoteLabel } from './askQuestion'
import { orderedEvidence } from './textExplanation'

/**
 * '출처 포함 복사'(3.10, FS-12)에 넣을 글. 답·풀이 문장 뒤에 원문 위치(보고서·섹션·접수번호)와
 * AI 생성 표시·안내를 붙여, 붙여 넣은 곳에서도 어디서 나온 글인지 알 수 있게 한다.
 */

export const COPY_NOTICE = '공시 원문 기준 요약이며 투자 조언이 아니에요. 출처: 금융감독원 전자공시시스템(DART)'

/** 마지막 줄. 'AI 생성(모델, 2026-10-24 10:12) · 안내'. 모델·시각이 없으면 있는 것만 괄호에 넣는다 */
export function aiCopyLine(ai: AiInfo | null): string {
  const time = ai?.generatedAt ? ai.generatedAt.replace('T', ' ').slice(0, 16) : null
  const parts = [ai?.model, time].filter((p): p is string => typeof p === 'string' && p.trim() !== '')
  const label = parts.length > 0 ? `AI 생성(${parts.join(', ')})` : 'AI 생성'
  return `${label} · ${COPY_NOTICE}`
}

/** 받은 답(ANSWERED)을 복사할 글. 답 안의 [1]·[F1] 표시는 그대로 두고 아래 출처·수치 줄과 맞춘다 */
export function answerCopyText(item: QuestionAnswer): string {
  const blocks = [`Q. ${item.question.trim()}`, (item.answer ?? '').trim()]
  if (item.citations.length > 0) {
    const lines = item.citations.flatMap((c) => [
      `[${c.no}] ${[citationSideLabel(c.side), c.reportName, displaySectionPath(c.sectionPath), `접수번호 ${c.rceptNo}`].join(' · ')}`,
      `    “${quoteLabel(c.quote)}”`,
    ])
    blocks.push(['출처', ...lines].join('\n'))
  }
  if (item.facts.length > 0) {
    blocks.push(['수치', ...item.facts.map((f) => `[${f.ref}] ${f.sentence}`)].join('\n'))
  }
  blocks.push(aiCopyLine(item.ai))
  return blocks.join('\n\n')
}

/** 풀이 근거 줄의 보고서 이름 */
export interface CopyReports {
  previous: string
  current: string
}

function explanationSide(side: DocumentSide): string {
  return match(side)
    .with('previous', () => '이전')
    .with('current', () => '현재')
    .exhaustive()
}

/** 문장 변경 AI 한 줄 풀이(OK)를 복사할 글. 근거는 이전 → 현재 순서(화면과 같음) */
export function explanationCopyText(explanation: TextExplanation, reports: CopyReports): string {
  const blocks = [(explanation.sentence ?? '').trim()]
  const evidence = orderedEvidence(explanation.evidence)
  if (evidence.length > 0) {
    const lines = evidence.map((e) =>
      [
        explanationSide(e.side),
        reports[e.side],
        e.sectionPath === null ? null : displaySectionPath(e.sectionPath),
        `접수번호 ${e.rceptNo}`,
        `블록 ${e.blockNo}`,
      ]
        .filter((p): p is string => p !== null && p.trim() !== '')
        .join(' · '),
    )
    blocks.push(['근거', ...lines].join('\n'))
  }
  blocks.push(aiCopyLine(explanation.ai))
  return blocks.join('\n\n')
}
