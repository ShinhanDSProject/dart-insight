import { describe, expect, it } from 'vitest'
import type { QuestionAnswer, QuestionCitation, QuestionFact } from '@/shared/api/questions'
import type { TextChangeItem, TextExplanation, TextExplanationEvidence } from '@/shared/api/textChanges'
import {
  aiCopyLine,
  answerCopyText,
  clipSentence,
  COPY_NOTICE,
  explanationCopyText,
  PINNED_COPY_NOTICE,
  pinnedChangesText,
} from './copyText'

const ai = { model: 'gpt-4o-mini', promptVersion: 'ask-v1', generatedAt: '2026-10-24T10:12:30' }

const citation: QuestionCitation = {
  no: 1,
  evidenceId: '20250514000123#B12',
  side: 'current',
  rceptNo: '20250514000123',
  reportName: '분기보고서 (2025.03)',
  sectionNo: 4,
  blockNo: 12,
  sectionPath: 'II. 사업의 내용 > 1. 사업의 개요',
  quote: '반도체 수요 회복으로 매출이 늘었습니다.',
}

const fact: QuestionFact = {
  ref: 'F1',
  changeId: 7,
  sjDiv: 'IS',
  accountName: '매출액',
  sentence: '매출액이 10조 원에서 12조 원으로 2조 원(20.0%) 늘었어요.',
}

const answer = (over: Partial<QuestionAnswer> = {}) =>
  ({
    questionId: 3,
    question: ' 매출액은 왜 늘었나요? ',
    status: 'ANSWERED',
    answer: '반도체 수요가 회복됐어요[1]. 매출액은 20.0% 늘었어요[F1].',
    message: null,
    citations: [citation],
    facts: [fact],
    ai,
    createdAt: '2026-10-24T10:12:31',
    ...over,
  }) as QuestionAnswer

describe('aiCopyLine', () => {
  it('모델 이름과 만든 시각(분까지)을 괄호에 넣고 안내를 붙인다', () => {
    expect(aiCopyLine(ai)).toBe(`AI 생성(gpt-4o-mini, 2026-10-24 10:12) · ${COPY_NOTICE}`)
  })

  it('모델·시각 가운데 없는 것은 빼고, 둘 다 없으면 괄호 없이 쓴다', () => {
    expect(aiCopyLine({ model: null, promptVersion: null, generatedAt: '2026-10-24T10:12:30' })).toBe(
      `AI 생성(2026-10-24 10:12) · ${COPY_NOTICE}`,
    )
    expect(aiCopyLine(null)).toBe(`AI 생성 · ${COPY_NOTICE}`)
  })

  it('안내에 투자 조언이 아니라는 말과 DART 출처가 들어 있다', () => {
    expect(COPY_NOTICE).toContain('투자 조언이 아니에요')
    expect(COPY_NOTICE).toContain('금융감독원 전자공시시스템(DART)')
  })
})

describe('answerCopyText', () => {
  it('질문·답·출처·수치·AI 생성 줄을 빈 줄로 나눠 잇는다', () => {
    expect(answerCopyText(answer())).toBe(
      [
        'Q. 매출액은 왜 늘었나요?',
        '',
        '반도체 수요가 회복됐어요[1]. 매출액은 20.0% 늘었어요[F1].',
        '',
        '출처',
        '[1] 현재 · 분기보고서 (2025.03) · II. 사업의 내용 > 1. 사업의 개요 · 접수번호 20250514000123',
        '    “반도체 수요 회복으로 매출이 늘었습니다.”',
        '',
        '수치',
        '[F1] 매출액이 10조 원에서 12조 원으로 2조 원(20.0%) 늘었어요.',
        '',
        `AI 생성(gpt-4o-mini, 2026-10-24 10:12) · ${COPY_NOTICE}`,
      ].join('\n'),
    )
  })

  it('비교 보고서 인용은 화면처럼 비교로 적고, 섹션 제목은 화면에 보이는 꼴로 바꾼다', () => {
    const text = answerCopyText(
      answer({ citations: [{ ...citation, side: 'previous', sectionPath: '반 기 보 고 서 > 1. 개요' }], facts: [] }),
    )
    expect(text).toContain('[1] 비교 · 분기보고서 (2025.03) · 반기보고서 > 1. 개요 · 접수번호 20250514000123')
    expect(text).not.toContain('수치')
  })

  it('160자로 잘린 인용은 말줄임표를 붙인다', () => {
    const long = '가'.repeat(160)
    expect(answerCopyText(answer({ citations: [{ ...citation, quote: long }] }))).toContain(`“${long}…”`)
  })

  it('인용·수치가 없으면 출처·수치 묶음을 쓰지 않는다', () => {
    expect(answerCopyText(answer({ citations: [], facts: [] }))).toBe(
      ['Q. 매출액은 왜 늘었나요?', '반도체 수요가 회복됐어요[1]. 매출액은 20.0% 늘었어요[F1].', aiCopyLine(ai)].join('\n\n'),
    )
  })
})

describe('explanationCopyText', () => {
  const reports = { previous: '사업보고서 (2024.12)', current: '분기보고서 (2025.03)' }
  const evidence = (over: Partial<TextExplanationEvidence>): TextExplanationEvidence => ({
    side: 'current',
    rceptNo: '20250514000123',
    sectionNo: 4,
    blockNo: 12,
    sectionPath: 'II. 사업의 내용',
    evidenceId: '20250514000123#B12',
    ...over,
  })
  const explanation = (over: Partial<TextExplanation> = {}): TextExplanation => ({
    changeId: 5,
    status: 'OK',
    sentence: '주요 고객 목록에서 한 곳이 빠졌어요.',
    message: null,
    evidence: [evidence({}), evidence({ side: 'previous', rceptNo: '20250310000456', blockNo: 9, evidenceId: '20250310000456#B9' })],
    ai,
    cached: false,
    ...over,
  })

  it('풀이 문장·근거(이전 → 현재)·AI 생성 줄을 잇는다', () => {
    expect(explanationCopyText(explanation(), reports)).toBe(
      [
        '주요 고객 목록에서 한 곳이 빠졌어요.',
        '',
        '근거',
        '이전 · 사업보고서 (2024.12) · II. 사업의 내용 · 접수번호 20250310000456 · 블록 9',
        '현재 · 분기보고서 (2025.03) · II. 사업의 내용 · 접수번호 20250514000123 · 블록 12',
        '',
        `AI 생성(gpt-4o-mini, 2026-10-24 10:12) · ${COPY_NOTICE}`,
      ].join('\n'),
    )
  })

  it('섹션 경로를 찾지 못한 근거는 경로를 빼고, 같은 근거 ID는 한 번만 쓴다', () => {
    const text = explanationCopyText(explanation({ evidence: [evidence({ sectionPath: null }), evidence({ sectionPath: null })] }), reports)
    expect(text).toContain('근거\n현재 · 분기보고서 (2025.03) · 접수번호 20250514000123 · 블록 12\n\n')
  })

  it('근거가 없으면 근거 묶음을 쓰지 않는다', () => {
    expect(explanationCopyText(explanation({ evidence: [] }), reports)).toBe(
      ['주요 고객 목록에서 한 곳이 빠졌어요.', aiCopyLine(ai)].join('\n\n'),
    )
  })
})

describe('pinnedChangesText', () => {
  const analysis = {
    corpName: '삼성전자',
    previous: { reportName: '반기보고서 (2025.06)', rceptNo: '20250814000111' },
    current: { reportName: '반기보고서 (2026.06)', rceptNo: '20260814000222' },
  }
  const change = (over: Partial<TextChangeItem> = {}): TextChangeItem => ({
    changeId: 1,
    changeNo: 1,
    changeType: 'MODIFIED',
    blockType: 'PARAGRAPH',
    numbersOnly: false,
    sectionStatus: 'MATCHED',
    sectionTitle: '5. 위험관리 및 파생거래',
    sectionPath: 'II. 사업의 내용 > 5. 위험관리 및 파생거래',
    previousSectionPath: null,
    previousPreview: '환율 변동 위험이 있습니다.',
    currentPreview: '환율과 금리 변동 위험이 있습니다.',
    similarity: 0.8,
    reviewReason: null,
    priority: null,
    ...over,
  })

  it('맨 위에 회사·두 보고서 접수번호와 건수를, 끝에 원문만 옮겼다는 안내를 둔다', () => {
    const text = pinnedChangesText(analysis, [change(), change({ changeId: 2 })])
    const lines = text.split('\n')
    expect(lines[0]).toBe('삼성전자 · 반기보고서 (2025.06) [접수번호 20250814000111] → 반기보고서 (2026.06) [접수번호 20260814000222]')
    expect(lines[1]).toBe('고정한 문장 변경 2개 (DART Insight)')
    expect(text.endsWith(`\n\n${PINNED_COPY_NOTICE}`)).toBe(true)
  })

  it('변경마다 번호·화면과 같은 유형 이름·섹션 경로·이전·현재 문장·현재 원문 링크를 적는다', () => {
    const text = pinnedChangesText(analysis, [change(), change({ changeId: 2, changeType: 'REVIEW_NEEDED' })])
    expect(text).toContain(
      [
        '1. [수정] II. 사업의 내용 > 5. 위험관리 및 파생거래',
        '이전: 환율 변동 위험이 있습니다.',
        '현재: 환율과 금리 변동 위험이 있습니다.',
        '출처: https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20260814000222 (현재 보고서 원문)',
      ].join('\n'),
    )
    expect(text).toContain('2. [검토 필요] ')
  })

  it('추가는 이전 문장을 (없음)으로 두고 현재 원문을 출처로 둔다', () => {
    const text = pinnedChangesText(analysis, [change({ changeType: 'ADDED', previousPreview: null })])
    expect(text).toContain('1. [추가] ')
    expect(text).toContain('이전: (없음)\n현재: 환율과 금리 변동 위험이 있습니다.\n출처: https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20260814000222 (현재 보고서 원문)')
  })

  it('삭제는 현재 문장을 (없음)으로 두고 이전 보고서 원문을 출처로 둔다', () => {
    const text = pinnedChangesText(analysis, [change({ changeType: 'DELETED', currentPreview: null })])
    expect(text).toContain('1. [삭제] ')
    expect(text).toContain('현재: (없음)\n출처: https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20250814000111 (이전 보고서 원문)')
  })

  it('다른 섹션으로 옮긴 위치 이동은 옮기기 전 섹션 경로를 함께 적는다', () => {
    const moved = change({ changeType: 'MOVED', previousSectionPath: 'II. 사업의 내용 > 1. 사업의 개요' })
    expect(pinnedChangesText(analysis, [moved])).toContain(
      '1. [위치 이동] II. 사업의 내용 > 5. 위험관리 및 파생거래 (옮기기 전: II. 사업의 내용 > 1. 사업의 개요)',
    )
    const reordered = change({ changeType: 'MOVED', previousSectionPath: 'II. 사업의 내용 > 5. 위험관리 및 파생거래' })
    expect(pinnedChangesText(analysis, [reordered])).toContain('1. [위치 이동] II. 사업의 내용 > 5. 위험관리 및 파생거래\n')
  })

  it('숫자만 바뀜은 화면과 같은 유형 이름으로 적는다', () => {
    const text = pinnedChangesText(analysis, [change({ changeType: 'NUMERIC_UPDATE', numbersOnly: true })])
    expect(text).toContain('1. [숫자만 바뀜] ')
  })

  it('접수번호가 14자리가 아니면 링크 대신 접수번호를 적는다', () => {
    const text = pinnedChangesText({ ...analysis, current: { reportName: '반기보고서 (2026.06)', rceptNo: 'bad' } }, [change()])
    expect(text).toContain('출처: 접수번호 bad (현재 보고서 원문)')
  })

  it('섹션 경로는 화면처럼 바꿔 적는다', () => {
    const text = pinnedChangesText(analysis, [change({ sectionPath: '반 기 보 고 서 > (목차 밖 본문)' })])
    expect(text).toContain('1. [수정] 반기보고서 > 표지·목차 앞 내용')
  })

  it('AI 풀이나 AI 생성 표시는 넣지 않는다', () => {
    expect(pinnedChangesText(analysis, [change()])).not.toContain('AI 생성(')
  })
})

describe('clipSentence', () => {
  it('300자까지는 그대로 두고 넘으면 300자에서 자르고 …를 붙인다', () => {
    expect(clipSentence('가'.repeat(300))).toBe('가'.repeat(300))
    expect(clipSentence('가'.repeat(301))).toBe(`${'가'.repeat(300)}…`)
  })

  it('이모지처럼 두 칸짜리 글자도 반으로 자르지 않는다', () => {
    expect(clipSentence('😀😀😀', 2)).toBe('😀😀…')
  })

  it('줄바꿈과 겹친 공백은 한 칸으로 줄인다', () => {
    expect(clipSentence('  첫 줄\n\n둘째   줄 ')).toBe('첫 줄 둘째 줄')
  })

  it('없거나 빈 문장은 (없음)으로 적는다', () => {
    expect(clipSentence(null)).toBe('(없음)')
    expect(clipSentence('   ')).toBe('(없음)')
  })
})
