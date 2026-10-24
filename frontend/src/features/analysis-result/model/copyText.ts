import { match } from 'ts-pattern'
import type { DocumentSide } from '@/shared/api/documents'
import type { QuestionAnswer } from '@/shared/api/questions'
import type { AiInfo } from '@/shared/api/summary'
import type { ReportItem } from '@/shared/api/reports'
import type { TextChangeItem, TextExplanation } from '@/shared/api/textChanges'
import { dartViewerUrl } from '@/shared/lib/dart'
import { displaySectionPath } from '@/shared/lib/sectionTitle'
import { citationSideLabel, quoteLabel } from './askQuestion'
import { changeTypeLabel, movedPaths } from './textLabels'
import { formatCount } from './textFilter'
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

/** 고정한 변경 복사(3.3, FS-31)에 넣는 회사·두 보고서 */
export interface PinnedCopyAnalysis {
  corpName: string
  previous: Pick<ReportItem, 'reportName' | 'rceptNo'>
  current: Pick<ReportItem, 'reportName' | 'rceptNo'>
}

/** 한 문장을 옮길 때 최대 글자 수. 넘으면 자르고 '…'를 붙인다 */
export const PINNED_COPY_MAX_CHARS = 300
export const PINNED_COPY_NOTICE = '※ 공시 원문 문장만 옮겼어요. AI가 만든 설명은 넣지 않았어요.'
const EMPTY_SIDE = '(없음)'

/** 줄바꿈·겹친 공백을 한 칸으로 줄이고, 300자를 넘으면 자른다(한글·이모지가 반쪽으로 잘리지 않게 글자 단위) */
export function clipSentence(text: string | null, max = PINNED_COPY_MAX_CHARS): string {
  const flat = (text ?? '').replace(/\s+/g, ' ').trim()
  if (flat === '') return EMPTY_SIDE
  const chars = Array.from(flat)
  return chars.length > max ? `${chars.slice(0, max).join('')}…` : flat
}

function reportLine(report: Pick<ReportItem, 'reportName' | 'rceptNo'>): string {
  return `${report.reportName} [접수번호 ${report.rceptNo}]`
}

/** 다른 섹션으로 옮긴 위치 이동이면 옮기기 전 섹션 경로. 그 밖은 빈 글 */
function movedFrom(item: TextChangeItem): string {
  const paths = movedPaths(item)
  return paths === null || paths.sameSection ? '' : ` (옮기기 전: ${displaySectionPath(paths.from)})`
}

/** 삭제는 이전 보고서에만 있으므로 이전 원문, 그 밖은 현재 원문을 출처로 둔다 */
function sourceLine(item: TextChangeItem, analysis: PinnedCopyAnalysis): string {
  const side = item.changeType === 'DELETED' ? 'previous' : 'current'
  const report = analysis[side]
  const sideName = side === 'previous' ? '이전 보고서 원문' : '현재 보고서 원문'
  const url = dartViewerUrl(report.rceptNo)
  return url === null ? `출처: 접수번호 ${report.rceptNo} (${sideName})` : `출처: ${url} (${sideName})`
}

/**
 * '고정한 변경 출처 포함 복사'(3.3, FS-31)에 넣을 일반 텍스트. 맨 위에 회사·두 보고서(접수번호),
 * 변경마다 유형·섹션 경로·이전·현재 문장·DART 원문 링크, 끝에 원문만 옮겼다는 안내를 둔다. AI 풀이는 넣지 않는다.
 */
export function pinnedChangesText(analysis: PinnedCopyAnalysis, items: readonly TextChangeItem[]): string {
  const head = [
    `${analysis.corpName} · ${reportLine(analysis.previous)} → ${reportLine(analysis.current)}`,
    `고정한 문장 변경 ${formatCount(items.length)}개 (DART Insight)`,
  ].join('\n')
  const changes = items.map((item, i) =>
    [
      `${formatCount(i + 1)}. [${changeTypeLabel(item.changeType)}] ${displaySectionPath(item.sectionPath)}${movedFrom(item)}`,
      `이전: ${clipSentence(item.previousPreview)}`,
      `현재: ${clipSentence(item.currentPreview)}`,
      sourceLine(item, analysis),
    ].join('\n'),
  )
  return [head, ...changes, PINNED_COPY_NOTICE].join('\n\n')
}
