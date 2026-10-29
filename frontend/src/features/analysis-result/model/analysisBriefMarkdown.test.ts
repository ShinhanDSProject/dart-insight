import { describe, expect, it } from 'vitest'
import type { Analysis } from '@/shared/api/analyses'
import type { FinancialChangeItem } from '@/shared/api/results'
import type { Summary } from '@/shared/api/summary'
import type { TextChangeItem } from '@/shared/api/textChanges'
import {
  briefFileName,
  buildAnalysisBriefMarkdown,
  fileNamePart,
  type FinancialBriefGroup,
} from './analysisBriefMarkdown'

const mockAnalysis: Analysis = {
  analysisId: 101,
  corpCode: '00126380',
  corpName: '삼성전자',
  basis: 'YOY',
  fsDiv: 'CFS',
  current: {
    rceptNo: '20260814000123',
    reportName: '반기보고서 (2026.06)',
    reportType: 'HALF',
    disclosureType: 'A002',
    fiscalYear: 2026,
    periodEnd: '2026-06-30',
    receivedAt: '2026-08-14',
    correction: 'ORIGINAL',
    financialDataStatus: 'AVAILABLE',
    dartUrl: 'https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20260814000123',
  },
  previous: {
    rceptNo: '20250814000001',
    reportName: '반기보고서 (2025.06)',
    reportType: 'HALF',
    disclosureType: 'A002',
    fiscalYear: 2025,
    periodEnd: '2025-06-30',
    receivedAt: '2025-08-14',
    correction: 'ORIGINAL',
    financialDataStatus: 'AVAILABLE',
    dartUrl: 'https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20250814000001',
  },
  status: 'COMPLETED',
  step: 'DONE',
  steps: [],
  error: null,
  createdAt: '2026-08-15T09:00:00Z',
  completedAt: '2026-08-15T09:02:00Z',
  textStatus: 'COMPLETED',
  textMessage: null,
  summaryStatus: 'COMPLETED',
  summaryMessage: null,
  analysisVersion: 'm2-15',
  outdated: false,
}

const mockSummary: Summary = {
  analysisId: 101,
  summaryStatus: 'COMPLETED',
  summaryMessage: null,
  textStatus: 'COMPLETED',
  items: [
    {
      itemNo: 1,
      kind: 'FINANCIAL',
      target: { type: 'FINANCIAL', changeId: 1, sjDiv: 'IS' },
      lens: 'PROFITABILITY',
      lensLabel: '수익성',
      factSentence: '영업이익이 1조 2,000억원 증가했어요.',
      aiText: '반도체 업황 회복에 따른 판가 상승이 주요 원인이에요.',
      aiGenerated: true,
      explanationStatus: 'FOUND',
      explanationGrade: 'STATED',
      quote: null,
      quoteEvidence: null,
      gradeReason: null,
      evidence: [
        {
          evidenceId: '20260814000123#B12',
          side: 'current',
          rceptNo: '20260814000123',
          sectionNo: 4,
          blockNo: 12,
        },
      ],
      ai: {
        model: 'gemini-1.5-pro',
        promptVersion: 'p-v2',
        generatedAt: '2026-08-15 09:01:23',
      },
    },
    {
      itemNo: 2,
      kind: 'FINANCIAL',
      target: { type: 'FINANCIAL', changeId: 2, sjDiv: 'BS' },
      lens: 'STABILITY',
      lensLabel: '재무 안정성',
      factSentence: '차입금이 5,000억원 감소했어요.',
      aiText: '미검증 설명 문장입니다.',
      aiGenerated: true,
      explanationStatus: 'REVIEW_NEEDED',
      explanationGrade: null,
      quote: null,
      quoteEvidence: null,
      gradeReason: null,
      evidence: [],
      ai: {
        model: 'gemini-1.5-pro',
        promptVersion: 'p-v2',
        generatedAt: '2026-08-15 09:01:23',
      },
    },
    {
      itemNo: 3,
      kind: 'TEXT',
      target: { type: 'TEXT', changeId: 10, sjDiv: null },
      lens: 'RISK',
      lensLabel: '위험',
      factSentence: null,
      aiText: '환율 변동성 관련 위험 관리 정책이 개정되었어요.',
      aiGenerated: true,
      explanationStatus: 'FOUND',
      explanationGrade: null,
      quote: null,
      quoteEvidence: null,
      gradeReason: null,
      evidence: [
        {
          evidenceId: '20260814000123#B45',
          side: 'current',
          rceptNo: '20260814000123',
          sectionNo: 8,
          blockNo: 45,
        },
      ],
      ai: {
        model: 'gemini-1.5-pro',
        promptVersion: 'p-v2',
        generatedAt: '2026-08-15 09:01:24',
      },
    },
  ],
  lensCounts: [
    { lens: 'PROFITABILITY', lensLabel: '수익성', count: 1 },
    { lens: 'STABILITY', lensLabel: '재무 안정성', count: 1 },
    { lens: 'RISK', lensLabel: '위험', count: 1 },
  ],
  reviewNeededCount: 1,
  reviewNeeded: [
    {
      itemNo: 2,
      kind: 'FINANCIAL',
      target: { type: 'FINANCIAL', changeId: 2, sjDiv: 'BS' },
      lens: 'STABILITY',
      lensLabel: '재무 안정성',
      reason: '근거 확인 실패',
      blockedRules: [],
    },
  ],
}

const mockFinancialItem: FinancialChangeItem = {
  changeId: 1,
  sjDiv: 'IS',
  accountName: '영업이익',
  accountDetail: null,
  amountBasis: 'CUMULATIVE',
  previousAmount: 10_000_000_000_000,
  currentAmount: 11_200_000_000_000,
  changeAmount: 1_200_000_000_000,
  changeRate: 0.12,
  direction: 'UP',
  calcStatus: 'OK',
  calcMessage: null,
  currency: 'KRW',
  scale: {
    base: 'REVENUE',
    baseAccountName: '매출액',
    baseAmount: 100_000_000_000_000,
    ratio: 0.012,
    reason: null,
  },
}

const mockFinancialGroups: FinancialBriefGroup[] = [
  {
    sjDiv: 'IS',
    label: '손익계산서',
    comparable: true,
    note: null,
    items: [mockFinancialItem],
  },
  {
    sjDiv: 'BS',
    label: '재무상태표',
    comparable: false,
    note: '회계 기준 변경으로 비교가 불가능해요.',
    items: [],
  },
]

const mockRiskChanges: TextChangeItem[] = [
  {
    changeId: 101,
    changeNo: 1,
    changeType: 'MODIFIED',
    blockType: 'PARAGRAPH',
    numbersOnly: false,
    sectionStatus: 'MATCHED',
    sectionTitle: '이사의 경영진단 및 분석의견',
    sectionPath: 'II. 사업의 내용 > 7. 위험관리',
    previousSectionPath: null,
    previousPreview: '환율 변동에 대한 파생상품 헷지를 체결하지 않음.',
    currentPreview: '환율 변동성 확대에 대응해 통화스왑 계약을 신규 체결함.',
    similarity: 0.65,
    reviewReason: null,
    priority: { level: 'HIGH', score: 85, reasons: ['위험 섹션'] },
    riskRelated: true,
  },
]

describe('fileNamePart & briefFileName', () => {
  it('파일명에 쓸 수 없는 특수문자와 제어문자를 치환하고 마침표를 정리한다', () => {
    expect(fileNamePart('삼성전자/반도체:DX*부문?')).toBe('삼성전자_반도체_DX_부문_')
    expect(fileNamePart('  보고서...  ')).toBe('보고서')
  })

  it('비교 브리프 파일명을 규칙대로 생성한다', () => {
    const fileName = briefFileName(mockAnalysis)
    expect(fileName).toBe('삼성전자_반도체보고서 (2025.06)_vs_반도체보고서 (2026.06)_비교브리프.md'.replace(/반도체/g, '반기'))
  })
})

describe('buildAnalysisBriefMarkdown', () => {
  it('정상적인 분석 결과를 완전한 Markdown 브리프로 생성한다', () => {
    const md = buildAnalysisBriefMarkdown({
      analysis: mockAnalysis,
      summary: mockSummary,
      financialGroups: mockFinancialGroups,
      riskTextChanges: mockRiskChanges,
    })

    // 제목 및 고지 문구
    expect(md).toContain('# 삼성전자 정기보고서 비교 브리프')
    expect(md).toContain('> 이 문서는 DART 정기보고서 원문을 바탕으로 코드와 AI가 정리한 비교 자료이며, 투자 권유나 종목 추천이 아니에요.')

    // 1. 비교 맥락
    expect(md).toContain('## 1. 비교 맥락')
    expect(md).toContain('- 기업명: 삼성전자 (고유번호: 00126380)')
    expect(md).toContain('- 비교 기준: 전년 동기')
    expect(md).toContain('- 재무제표 기준: 연결 재무제표')
    expect(md).toContain('- 분석 버전: m2-15')
    expect(md).toContain('- 비교 보고서: 반기보고서 (2025.06) (접수번호: 20250814000001) · [DART 원문 보기](https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20250814000001)')
    expect(md).toContain('- 현재 보고서: 반기보고서 (2026.06) (접수번호: 20260814000123) · [DART 원문 보기](https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20260814000123)')

    // 2. 핵심 3줄 요약
    expect(md).toContain('## 2. 핵심 3줄 요약')
    expect(md).toContain('1. 영업이익이 1조 2,000억원 증가했어요.')
    expect(md).toContain('2. 차입금이 5,000억원 감소했어요.')
    expect(md).toContain('3. 환율 변동성 관련 위험 관리 정책이 개정되었어요. (AI 생성 · gemini-1.5-pro · p-v2, 근거: 20260814000123#B45)')

    // 3. 관점별 주요 변화
    expect(md).toContain('## 3. 투자자 관점별 주요 변화')
    expect(md).toContain('### 수익성')
    expect(md).toContain('- 사실: 영업이익이 1조 2,000억원 증가했어요.')
    expect(md).toContain('- 설명: 반도체 업황 회복에 따른 판가 상승이 주요 원인이에요. [AI 생성 · gemini-1.5-pro · p-v2 · 2026-08-15 09:01:23] (근거: 20260814000123#B12)')

    // 검증 실패 항목(reviewNeeded)의 설명은 배제되고 '확인된 설명 없음' 표시
    expect(md).toContain('### 재무 안정성')
    expect(md).toContain('- 사실: 차입금이 5,000억원 감소했어요.')
    expect(md).toContain('- 관련 설명: 확인된 설명 없음')
    expect(md).not.toContain('미검증 설명 문장입니다.')

    // 4. 주요 재무 수치 변화 표
    expect(md).toContain('## 4. 주요 재무 수치 변화 (규모 큰 순 상위)')
    expect(md).toContain('### 손익계산서')
    expect(md).toContain('| 계정 | 이전 | 현재 | 증감액 | 증감률 | 기준 대비 크기 |')
    expect(md).toContain('| 영업이익 | 10,000,000,000,000원 | 11,200,000,000,000원 | ▲ +1,200,000,000,000원 | +12.0% | 매출액 대비 +1.2% |')

    // 비교 불가 재무제표 사유
    expect(md).toContain('### 재무상태표')
    expect(md).toContain('- 비교 제외 사유: 회계 기준 변경으로 비교가 불가능해요.')

    // 5. 위험 관련 문장 변화
    expect(md).toContain('## 5. 위험 관련 목차 주요 문장 변화')
    expect(md).toContain('1. **II. 사업의 내용 > 7. 위험관리** · 수정')
    expect(md).toContain('   - 요약: 환율 변동성 확대에 대응해 통화스왑 계약을 신규 체결함.')
    expect(md).toContain('   - 근거: 접수번호 20260814000123')

    // 6. 출처
    expect(md).toContain('## 6. 출처')
    expect(md).toContain('출처: DART (금융감독원 전자공시시스템)')
  })

  it('투자 권유나 종목 추천 등 가치판단 표현이 포함되지 않는다', () => {
    const md = buildAnalysisBriefMarkdown({
      analysis: mockAnalysis,
      summary: mockSummary,
      financialGroups: mockFinancialGroups,
      riskTextChanges: mockRiskChanges,
    })

    const bannedWords = ['매수', '매도', '목표주가', '적정주가', '저평가', '고평가', '추천종목', '상승여력']
    for (const word of bannedWords) {
      expect(md).not.toContain(word)
    }
  })

  it('문장 비교가 FAILED 상태인 부분 완료 분석에서도 오류 없이 실패 사유를 명시한다', () => {
    const failedTextAnalysis: Analysis = {
      ...mockAnalysis,
      textStatus: 'FAILED',
      textMessage: '원문 파싱 중 오류가 발생했습니다.',
    }

    const md = buildAnalysisBriefMarkdown({
      analysis: failedTextAnalysis,
      summary: null,
      financialGroups: mockFinancialGroups,
      riskTextChanges: [],
    })

    expect(md).toContain('## 5. 위험 관련 목차 주요 문장 변화')
    expect(md).toContain('문장 비교에 실패해 위험 관련 변경을 확인할 수 없어요. (사유: 원문 파싱 중 오류가 발생했습니다.)')
    expect(md).toContain('요약 정보를 불러오지 못했어요.')
  })

  it('위험 관련 변경이 0건이면 없다는 안내를 표시한다', () => {
    const md = buildAnalysisBriefMarkdown({
      analysis: mockAnalysis,
      summary: mockSummary,
      financialGroups: mockFinancialGroups,
      riskTextChanges: [],
    })

    expect(md).toContain('## 5. 위험 관련 목차 주요 문장 변화')
    expect(md).toContain('위험 관련 목차에서 탐지된 문장 변경이 없어요.')
  })
})
