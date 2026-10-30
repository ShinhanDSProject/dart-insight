import { describe, expect, it } from 'vitest'
import {
  aiInfoLabel,
  explanationNote,
  gradeLabel,
  gradeNote,
  kindLabel,
  summaryItemQuestion,
  summaryLink,
  summaryNoteLabel,
  summaryNoteTarget,
  summaryQuoteLink,
  summaryStatusNotice,
  textCoverageNote,
} from './summaryLabels'

describe('summaryLabels', () => {
  it('요약 상태가 정상이면 안내가 없고, 아니면 사유를 보여 준다', () => {
    expect(summaryStatusNotice('COMPLETED', null)).toBeNull()
    expect(summaryStatusNotice('PARTIAL', null)).toContain('검토 필요')
    expect(summaryStatusNotice('EMPTY', '요약할 변화가 없어요.')).toBe('요약할 변화가 없어요.')
    expect(summaryStatusNotice(null, null)).toContain('다시 요청하면')
  })

  it('문장을 비교하지 못했으면 재무 수치만 요약했다고 알린다', () => {
    expect(textCoverageNote('COMPLETED')).toBeNull()
    expect(textCoverageNote('FAILED')).toContain('재무 수치 변화만')
    expect(textCoverageNote(null)).toContain('재무 수치 변화만')
  })

  it("설명이 없으면 '확인된 설명 없음', 근거를 확인하지 못했으면 '검토 필요'", () => {
    expect(explanationNote('FOUND')).toBeNull()
    expect(explanationNote('NOT_FOUND')).toMatch(/^확인된 설명 없음/)
    expect(explanationNote('REVIEW_NEEDED')).toMatch(/^검토 필요/)
    expect(explanationNote('TEMPLATE')).toMatch(/^검토 필요 · AI 설명이 검증을 통과하지 못해/)
  })

  it('코드가 인용을 확인하지 못해 낮춘 설명 없음은 후보가 없던 경우와 다른 문구를 쓴다', () => {
    const lowered = explanationNote('NOT_FOUND', '인용문이 후보 원문에 그대로 없어 설명으로 쓰지 않았어요.')
    expect(lowered).toMatch(/^확인된 설명 없음/)
    expect(lowered).toContain('인용을 원문에서 확인하지 못했어요')
    expect(lowered).not.toBe(explanationNote('NOT_FOUND', null))
    // 낮춘 사유는 설명 없음에만 쓰고, 설명이 있으면(RELATED로 낮춤) 안내가 없다
    expect(explanationNote('FOUND', "인용문에 계정 이름이 없어 '관련 내용'으로 낮췄어요.")).toBeNull()
  })

  it('설명 등급마다 제목이 다르고, 관련 내용에는 원인으로 읽히는 말이 없다', () => {
    expect(gradeLabel('STATED')).toBe('회사가 공시에서 밝힌 설명')
    expect(gradeLabel('RELATED')).toBe('관련 공시 내용')
    expect(gradeLabel('NONE')).toBeNull()
    expect(gradeLabel(null)).toBeNull()
    expect(gradeNote('STATED')).toBeNull()
    const related = `${gradeLabel('RELATED')} ${gradeNote('RELATED')}`
    for (const causal of ['때문', '으로 인해', '덕분', '영향으로', '원인', '이유']) {
      expect(related).not.toContain(causal)
    }
  })

  it('AI 생성 정보는 모델·프롬프트 버전·생성 시각을 보여 준다', () => {
    expect(aiInfoLabel({ model: 'fake-model', promptVersion: 'summary-1', generatedAt: '2026-10-22T09:00:00' })).toBe(
      'fake-model · 프롬프트 summary-1 · 2026-10-22 09:00 생성',
    )
    expect(aiInfoLabel(null)).toBe('')
    expect(kindLabel('TEXT')).toBe('문장 변화')
  })

  it('요약 항목은 열 수 있는 결과로만 이어진다', () => {
    expect(summaryLink({ type: 'FINANCIAL', changeId: 3, sjDiv: 'IS' })).toEqual({ tab: 'financial', sjDiv: 'IS', changeId: 3 })
    expect(summaryLink({ type: 'TEXT', changeId: 7, sjDiv: null })).toEqual({ tab: 'text', changeId: 7 })
    expect(summaryLink({ type: 'FINANCIAL', changeId: 3, sjDiv: null })).toBeNull()
    expect(summaryLink({ type: 'TEXT', changeId: null, sjDiv: null })).toBeNull()
  })

  it('요약 카드의 노트 담기·커뮤니티 인용·AI 질문을 원본 변경 ID 기준으로 조립한다(#536)', () => {
    expect(summaryNoteTarget({ type: 'FINANCIAL', changeId: 3, sjDiv: 'IS' })).toEqual({
      kind: 'FINANCIAL_CHANGE',
      changeId: 3,
    })
    expect(summaryNoteTarget({ type: 'TEXT', changeId: 7, sjDiv: null })).toEqual({
      kind: 'TEXT_CHANGE',
      changeId: 7,
    })
    expect(summaryNoteTarget({ type: 'TEXT', changeId: null, sjDiv: null })).toBeNull()

    expect(
      summaryNoteLabel(
        { itemNo: 1, kind: 'FINANCIAL', factSentence: '매출액이 늘었어요.', aiText: null },
        { accountName: '매출액' },
      ),
    ).toBe('매출액')
    expect(
      summaryNoteLabel({ itemNo: 2, kind: 'TEXT', factSentence: null, aiText: '우발부채 문단에 소송 1건이 더해졌어요.' }),
    ).toBe('우발부채 문단에 소송 1건이 더해졌어요')

    expect(summaryQuoteLink('00126380', 42, { type: 'FINANCIAL', changeId: 3, sjDiv: 'IS' })).toBe(
      '/companies/00126380?view=community&quoteAnalysis=42&quoteKind=FINANCIAL_CHANGE&quoteChange=3&quoteSj=IS',
    )
    expect(summaryQuoteLink('00126380', 42, { type: 'TEXT', changeId: 7, sjDiv: null })).toBe(
      '/companies/00126380?view=community&quoteAnalysis=42&quoteKind=TEXT_CHANGE&quoteChange=7',
    )
    expect(summaryQuoteLink(undefined, 42, { type: 'TEXT', changeId: 7, sjDiv: null })).toBeNull()
    expect(summaryQuoteLink('00126380', 42, { type: 'TEXT', changeId: null, sjDiv: null })).toBeNull()

    expect(
      summaryItemQuestion(
        {
          kind: 'FINANCIAL',
          target: { type: 'FINANCIAL', changeId: 3, sjDiv: 'IS' },
          factSentence: '매출액이 145조 원에서 152조 원으로 늘었어요(+4.8%).',
          aiText: null,
        },
        { accountName: '매출액', direction: 'UP' },
      ),
    ).toBe('매출액은 왜 늘었나요?')

    const textQ = summaryItemQuestion({
      kind: 'TEXT',
      target: { type: 'TEXT', changeId: 7, sjDiv: null },
      factSentence: null,
      aiText: '우발부채 문단에 소송 1건이 더해졌어요.',
    })
    expect(textQ).toBe("'우발부채 문단에 소송 1건이 더해졌어요' 관련 공시 원문 내용은 무엇인가요?")
    expect(textQ).not.toMatch(/매수|매도|추천|목표주가|저평가|고평가|유망|호재|악재/)

    expect(
      summaryItemQuestion({
        kind: 'TEXT',
        target: { type: 'TEXT', changeId: null, sjDiv: null },
        factSentence: null,
        aiText: '변경 ID 없는 문장',
      }),
    ).toBeNull()
  })
})
