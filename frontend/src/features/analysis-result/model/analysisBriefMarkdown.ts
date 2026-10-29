import type { Analysis } from '@/shared/api/analyses'
import type { FinancialChangeItem, SjDiv } from '@/shared/api/results'
import type { Summary } from '@/shared/api/summary'
import type { TextChangeItem } from '@/shared/api/textChanges'
import { basisLabel } from '@/shared/lib/comparisonBasis'
import { verifiedDartUrl } from '@/shared/lib/dart'
import { accountLabel } from './accountLabel'
import { scaleLine } from './changeScale'
import { formatRate, shortCalcLabel } from './format'
import { headlineItems } from './summaryHeadline'
import { groupByLens } from './summaryLens'
import { changeTypeLabel } from './textLabels'

export interface FinancialBriefGroup {
  sjDiv: SjDiv
  label: string
  comparable: boolean
  note: string | null
  items: FinancialChangeItem[]
}

export interface AnalysisBriefInput {
  analysis: Analysis
  summary: Summary | null
  financialGroups: FinancialBriefGroup[]
  riskTextChanges: TextChangeItem[]
}

const wonFormat = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 })

function formatAmountWon(value: number | null): string {
  if (value === null) return '-'
  return `${wonFormat.format(value)}원`
}

function formatChangeWon(value: number | null): string {
  if (value === null) return '-'
  if (value === 0) return '0원'
  const prefix = value > 0 ? '▲ +' : '▼ −'
  return `${prefix}${wonFormat.format(Math.abs(value))}원`
}

function markdownTableCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ')
}

/** 파일 이름에 쓸 수 없는 글자(\ / : * ? " < > |, 제어 문자)를 _로 바꾸고 앞뒤 공백·마침표를 뺀다 */
export function fileNamePart(value: string): string {
  return (
    value
      // eslint-disable-next-line no-control-regex
      .replace(/[\\/:*?"<>|\u0000-\u001f\u007f]/g, '_')
      .replace(/\s+/g, ' ')
      .replace(/^[\s.]+|[\s.]+$/g, '')
  )
}

/** {회사}_{이전 보고서}_vs_{현재 보고서}_비교브리프.md */
export function briefFileName(analysis: Analysis): string {
  const corp = fileNamePart(analysis.corpName) || '기업'
  const prev = fileNamePart(analysis.previous.reportName) || '이전보고서'
  const curr = fileNamePart(analysis.current.reportName) || '현재보고서'
  return `${corp}_${prev}_vs_${curr}_비교브리프.md`
}

function buildContextSection(analysis: Analysis): string {
  const prevDart = verifiedDartUrl(analysis.previous.rceptNo, analysis.previous.dartUrl)
  const currDart = verifiedDartUrl(analysis.current.rceptNo, analysis.current.dartUrl)
  const prevLink = prevDart ? ` · [DART 원문 보기](${prevDart})` : ''
  const currLink = currDart ? ` · [DART 원문 보기](${currDart})` : ''
  const fsLabel = analysis.fsDiv === 'OFS' ? '별도(개별)' : '연결'
  const outdatedNotice = analysis.outdated ? ' (최신 버전과 다른 방식의 분석이에요)' : ''

  return [
    '## 1. 비교 맥락',
    `- 기업명: ${analysis.corpName} (고유번호: ${analysis.corpCode})`,
    `- 비교 기준: ${basisLabel(analysis.basis)}`,
    `- 재무제표 기준: ${fsLabel} 재무제표`,
    `- 분석 버전: ${analysis.analysisVersion}${outdatedNotice}`,
    `- 비교 보고서: ${analysis.previous.reportName} (접수번호: ${analysis.previous.rceptNo})${prevLink}`,
    `- 현재 보고서: ${analysis.current.reportName} (접수번호: ${analysis.current.rceptNo})${currLink}`,
  ].join('\n')
}

function buildHeadlineSection(summary: Summary | null): string {
  if (summary === null) {
    return '## 2. 핵심 3줄 요약\n\n요약 정보를 불러오지 못했어요.'
  }

  if (summary.summaryStatus === 'EMPTY') {
    return '## 2. 핵심 3줄 요약\n\n두 보고서 사이에 요약할 만한 핵심 변화가 없어요.'
  }

  if (summary.summaryMessage) {
    return `## 2. 핵심 3줄 요약\n\n요약 안내: ${summary.summaryMessage}`
  }

  const headlines = headlineItems(summary)
  if (headlines.length === 0) {
    return '## 2. 핵심 3줄 요약\n\n핵심 요약 항목이 없어요.'
  }

  const lines = headlines.map((h, index) => {
    const raw = summary.items.find((i) => i.itemNo === h.itemNo)
    let meta = ''
    if (h.aiGenerated && raw?.ai) {
      const parts = ['AI 생성']
      if (raw.ai.model) parts.push(raw.ai.model)
      if (raw.ai.promptVersion) parts.push(raw.ai.promptVersion)
      const evidenceIds = (raw.evidence ?? []).map((e) => e.evidenceId).filter(Boolean)
      const evStr = evidenceIds.length > 0 ? `, 근거: ${evidenceIds.join(', ')}` : ''
      meta = ` (${parts.join(' · ')}${evStr})`
    }
    return `${index + 1}. ${h.text}${meta}`
  })

  return `## 2. 핵심 3줄 요약\n\n${lines.join('\n')}`
}

function buildLensSection(summary: Summary | null): string {
  if (summary === null || summary.items.length === 0) {
    return '## 3. 투자자 관점별 주요 변화\n\n관점별 주요 변화 정보가 없어요.'
  }

  const groups = groupByLens(summary.items)
  if (groups.length === 0) {
    return '## 3. 투자자 관점별 주요 변화\n\n표시할 관점별 변화 항목이 없어요.'
  }

  const sectionLines = ['## 3. 투자자 관점별 주요 변화']

  for (const group of groups) {
    sectionLines.push(`\n### ${group.label}`)
    for (const item of group.items) {
      if (item.factSentence && item.factSentence.trim() !== '') {
        sectionLines.push(`- 사실: ${item.factSentence}`)
      }

      const isReviewNeeded =
        item.explanationStatus === 'REVIEW_NEEDED' ||
        summary.reviewNeeded.some((r) => r.itemNo === item.itemNo)

      if (isReviewNeeded) {
        sectionLines.push('- 관련 설명: 확인된 설명 없음')
      } else if (item.aiText && item.aiText.trim() !== '') {
        const parts = ['AI 생성']
        if (item.ai?.model) parts.push(item.ai.model)
        if (item.ai?.promptVersion) parts.push(item.ai.promptVersion)
        if (item.ai?.generatedAt) parts.push(item.ai.generatedAt)
        const metaStr = `[${parts.join(' · ')}]`
        const evidenceIds = (item.evidence ?? []).map((e) => e.evidenceId).filter(Boolean)
        const evStr = evidenceIds.length > 0 ? ` (근거: ${evidenceIds.join(', ')})` : ''
        const label = item.kind === 'FINANCIAL' ? '설명' : '요약'
        sectionLines.push(`- ${label}: ${item.aiText} ${metaStr}${evStr}`)
      } else if (item.kind === 'FINANCIAL') {
        sectionLines.push('- 관련 설명: 확인된 설명 없음')
      }
    }
  }

  return sectionLines.join('\n')
}

function buildFinancialSection(groups: FinancialBriefGroup[]): string {
  const sectionLines = ['## 4. 주요 재무 수치 변화 (규모 큰 순 상위)']

  if (groups.length === 0) {
    sectionLines.push('\n재무제표 수치 변화 정보가 없어요.')
    return sectionLines.join('\n')
  }

  for (const group of groups) {
    sectionLines.push(`\n### ${group.label}`)
    if (!group.comparable) {
      sectionLines.push(`- 비교 제외 사유: ${group.note ?? '비교할 수 없는 재무제표예요.'}`)
      continue
    }

    const topItems = group.items.slice(0, 5)
    if (topItems.length === 0) {
      sectionLines.push('- 변경된 계정이 없어요.')
      continue
    }

    sectionLines.push('| 계정 | 이전 | 현재 | 증감액 | 증감률 | 기준 대비 크기 |')
    sectionLines.push('| --- | --- | --- | --- | --- | --- |')

    for (const item of topItems) {
      const name = markdownTableCell(accountLabel(item))
      const prev = markdownTableCell(formatAmountWon(item.previousAmount))
      const curr = markdownTableCell(formatAmountWon(item.currentAmount))
      const change = markdownTableCell(formatChangeWon(item.changeAmount))
      const rateStr =
        item.calcStatus === 'OK' && item.changeRate !== null
          ? (formatRate(item.changeRate) ?? '-')
          : (shortCalcLabel(item.calcStatus) ?? item.calcStatus)
      const rate = markdownTableCell(rateStr)
      const scaleStr = scaleLine(item.scale) ?? '-'
      const scale = markdownTableCell(scaleStr)

      sectionLines.push(`| ${name} | ${prev} | ${curr} | ${change} | ${rate} | ${scale} |`)
    }
  }

  return sectionLines.join('\n')
}

function buildRiskTextSection(analysis: Analysis, riskChanges: TextChangeItem[]): string {
  const sectionLines = ['## 5. 위험 관련 목차 주요 문장 변화']

  if (analysis.textStatus === 'FAILED') {
    const reason = analysis.textMessage ? ` (사유: ${analysis.textMessage})` : ''
    sectionLines.push(`\n문장 비교에 실패해 위험 관련 변경을 확인할 수 없어요.${reason}`)
    return sectionLines.join('\n')
  }

  if (analysis.textStatus === null) {
    sectionLines.push('\n이 분석은 문장을 비교하지 않았어요.')
    return sectionLines.join('\n')
  }

  if (riskChanges.length === 0) {
    sectionLines.push('\n위험 관련 목차에서 탐지된 문장 변경이 없어요.')
    return sectionLines.join('\n')
  }

  const topChanges = riskChanges.slice(0, 5)
  sectionLines.push('')
  topChanges.forEach((item, index) => {
    const sectionPath = item.sectionPath || item.sectionTitle || '목차 미기재'
    const typeLabel = changeTypeLabel(item.changeType)
    const preview = item.currentPreview ?? item.previousPreview ?? '내용 없음'
    const rceptNo = item.changeType === 'DELETED' ? analysis.previous.rceptNo : analysis.current.rceptNo

    sectionLines.push(`${index + 1}. **${sectionPath}** · ${typeLabel}`)
    sectionLines.push(`   - 요약: ${preview}`)
    sectionLines.push(`   - 근거: 접수번호 ${rceptNo}`)
  })

  return sectionLines.join('\n')
}

function buildSourceSection(analysis: Analysis): string {
  const prevDart = verifiedDartUrl(analysis.previous.rceptNo, analysis.previous.dartUrl)
  const currDart = verifiedDartUrl(analysis.current.rceptNo, analysis.current.dartUrl)
  const prevLink = prevDart ? ` (${prevDart})` : ''
  const currLink = currDart ? ` (${currDart})` : ''

  return [
    '## 6. 출처',
    '출처: DART (금융감독원 전자공시시스템)',
    `- 이전 보고서: ${analysis.previous.reportName} (접수번호: ${analysis.previous.rceptNo})${prevLink}`,
    `- 현재 보고서: ${analysis.current.reportName} (접수번호: ${analysis.current.rceptNo})${currLink}`,
  ].join('\n')
}

export function buildAnalysisBriefMarkdown({
  analysis,
  summary,
  financialGroups,
  riskTextChanges,
}: AnalysisBriefInput): string {
  const disclaimer = '> 이 문서는 DART 정기보고서 원문을 바탕으로 코드와 AI가 정리한 비교 자료이며, 투자 권유나 종목 추천이 아니에요.'
  const title = `# ${analysis.corpName} 정기보고서 비교 브리프\n\n${disclaimer}`

  const sections = [
    title,
    buildContextSection(analysis),
    buildHeadlineSection(summary),
    buildLensSection(summary),
    buildFinancialSection(financialGroups),
    buildRiskTextSection(analysis, riskTextChanges),
    buildSourceSection(analysis),
  ]

  return sections.join('\n\n') + '\n'
}
