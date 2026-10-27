// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/shared/api/client'
import type { CompanyQuestionAnswer, CompanyQuestionHistory } from '@/shared/api/companyQuestions'
import { axeViolations } from '@/test/axe'
import { CompanyAskSection } from './CompanyAskSection'

const askCompanyQuestion = vi.fn<(corpCode: string, question: string) => Promise<CompanyQuestionAnswer>>()
const getCompanyQuestions = vi.fn<(corpCode: string, signal?: AbortSignal) => Promise<CompanyQuestionHistory>>()

vi.mock('@/shared/api/companyQuestions', () => ({
  askCompanyQuestion: (corpCode: string, question: string) => askCompanyQuestion(corpCode, question),
  getCompanyQuestions: (corpCode: string, signal?: AbortSignal) => getCompanyQuestions(corpCode, signal),
}))

const CORP = '00126380'
const RCEPT = '20260310000123'
const REPORT = {
  rceptNo: RCEPT,
  reportName: '사업보고서 (2025.12)',
  dartUrl: `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${RCEPT}`,
}
const QUOTE = '당사의 주요 제품은 스마트폰과 메모리 반도체입니다.'

function answered(questionId = 3, question = '주요 제품과 서비스는 무엇인가요?'): CompanyQuestionAnswer {
  return {
    questionId,
    question,
    status: 'ANSWERED',
    answer: '회사는 스마트폰과 메모리 반도체를 주요 제품으로 밝혔어요[1].',
    message: null,
    citations: [
      {
        no: 1,
        evidenceId: `${RCEPT}#B130`,
        rceptNo: RCEPT,
        sectionNo: 13,
        blockNo: 130,
        sectionPath: 'II. 사업의 내용 > 2. 주요 제품 및 서비스',
        quote: QUOTE,
      },
    ],
    report: REPORT,
    aiGenerated: true,
    ai: { model: 'fake-model', promptVersion: 'answer-2', generatedAt: '2026-10-26T10:12:03' },
    createdAt: '2026-10-26T10:12:03',
  }
}

function notAnswered(status: 'NOT_FOUND' | 'OUT_OF_SCOPE', message: string): CompanyQuestionAnswer {
  return { ...answered(9, '지금 사야 하나요?'), status, answer: null, message, citations: [], aiGenerated: false, ai: null }
}

beforeEach(() => {
  askCompanyQuestion.mockReset()
  getCompanyQuestions.mockReset()
  getCompanyQuestions.mockResolvedValue({ report: REPORT, items: [] })
})
afterEach(cleanup)

describe('AI에게 묻기 · 사업보고서 기준', () => {
  it('제목·예시 질문 3개·근거 보고서를 보이고 접근성 위반이 없다', async () => {
    const { container } = render(<CompanyAskSection corpCode={CORP} />)

    expect(screen.getByRole('heading', { name: 'AI에게 묻기 · 사업보고서 기준' })).toBeTruthy()
    expect(screen.getByRole('list', { name: '예시 질문' }).querySelectorAll('button')).toHaveLength(3)
    expect(await screen.findByText(/아직 한 질문이 없어요/)).toBeTruthy()
    expect(screen.getByText('사업보고서 (2025.12)')).toBeTruthy()
    expect(getCompanyQuestions).toHaveBeenCalledWith(CORP, expect.any(AbortSignal))
    expect(await axeViolations(container)).toBe('')
  })

  it('예시 질문을 누르면 묻고, 답에 AI 생성 표시와 펼칠 수 있는 인용을 보인다', async () => {
    askCompanyQuestion.mockResolvedValue(answered())
    const { container } = render(<CompanyAskSection corpCode={CORP} />)
    await screen.findByText(/아직 한 질문이 없어요/)

    fireEvent.click(screen.getByRole('button', { name: '주요 제품과 서비스는 무엇인가요?' }))
    expect(askCompanyQuestion).toHaveBeenCalledWith(CORP, '주요 제품과 서비스는 무엇인가요?')

    expect(await screen.findByText('회사는 스마트폰과 메모리 반도체를 주요 제품으로 밝혔어요[1].')).toBeTruthy()
    expect(screen.getByText('AI 생성')).toBeTruthy()
    expect(screen.getByText(/fake-model · 프롬프트 answer-2/)).toBeTruthy()

    const cite = screen.getByRole('button', { name: /원문 보기/ })
    expect(cite.textContent).toContain('[1] ')
    expect(cite.textContent).toContain('블록 130')
    expect(cite.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(cite)
    expect(cite.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByText(QUOTE)).toBeTruthy()
    expect(await axeViolations(container)).toBe('')

    fireEvent.click(cite)
    expect(screen.queryByText(QUOTE)).toBeNull()
  })

  it('투자 판단 질문은 답하지 않는다는 안내를, 찾지 못하면 찾지 못했다는 안내를 보이고 AI 생성 표시는 없다', async () => {
    askCompanyQuestion
      .mockResolvedValueOnce(notAnswered('OUT_OF_SCOPE', '투자 판단·주가 예측을 돕는 질문에는 답하지 않아요.'))
      .mockResolvedValueOnce({
        ...notAnswered('NOT_FOUND', '사업보고서에서 질문과 관련된 문단을 찾지 못했어요.'),
        questionId: 10,
        question: '배당 정책은?',
      })
    render(<CompanyAskSection corpCode={CORP} />)
    await screen.findByText(/아직 한 질문이 없어요/)

    fireEvent.change(screen.getByLabelText('직접 물어보기'), { target: { value: '지금 사야 하나요?' } })
    fireEvent.click(screen.getByRole('button', { name: '묻기' }))
    expect(await screen.findByText('답하지 않는 질문이에요')).toBeTruthy()
    expect((screen.getByLabelText('직접 물어보기') as HTMLInputElement).value).toBe('')

    fireEvent.change(screen.getByLabelText('직접 물어보기'), { target: { value: '배당 정책은?' } })
    fireEvent.click(screen.getByRole('button', { name: '묻기' }))
    expect(await screen.findByText('관련 내용을 찾지 못했어요')).toBeTruthy()
    expect(screen.queryByText('AI 생성')).toBeNull()
  })

  it('짧은 글은 보내지 않고 안내한다', async () => {
    render(<CompanyAskSection corpCode={CORP} />)
    await screen.findByText(/아직 한 질문이 없어요/)

    fireEvent.change(screen.getByLabelText('직접 물어보기'), { target: { value: '가' } })
    fireEvent.click(screen.getByRole('button', { name: '묻기' }))

    expect(screen.getByRole('alert').textContent).toBe('2자 이상 입력해 주세요.')
    expect(askCompanyQuestion).not.toHaveBeenCalled()
  })

  it('가장 최근 답 하나만 펼치고, 이전 질문 보기로 나머지를 최신 순으로 펼친다', async () => {
    getCompanyQuestions.mockResolvedValue({ report: REPORT, items: [answered(5, '주요 매출처는 어디인가요?'), answered(4)] })
    render(<CompanyAskSection corpCode={CORP} />)

    const cards = await screen.findAllByRole('article')
    expect(cards.map((c) => c.getAttribute('aria-label'))).toEqual(['질문: 주요 매출처는 어디인가요?'])

    const older = screen.getByRole('button', { name: '이전 질문 1개 보기' })
    expect(older.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(older)
    expect(screen.getAllByRole('article').map((c) => c.getAttribute('aria-label'))).toEqual([
      '질문: 주요 매출처는 어디인가요?',
      '질문: 주요 제품과 서비스는 무엇인가요?',
    ])
    expect(screen.getByRole('button', { name: '이전 질문 접기' }).getAttribute('aria-expanded')).toBe('true')
  })

  it('AI 서버를 쓸 수 없으면 코드별 안내와 다시 시도를 보이고, 다시 시도하면 같은 질문을 보낸다', async () => {
    askCompanyQuestion
      .mockRejectedValueOnce(
        new ApiError(503, { code: 'AI_SERVER_UNAVAILABLE', message: 'AI 서버가 응답하지 않습니다.', traceId: 't-1', errors: [] }),
      )
      .mockResolvedValueOnce(answered())
    render(<CompanyAskSection corpCode={CORP} />)
    await screen.findByText(/아직 한 질문이 없어요/)

    fireEvent.click(screen.getByRole('button', { name: '주요 제품과 서비스는 무엇인가요?' }))
    expect(await screen.findByText(/AI 서버를 지금 쓸 수 없어 답하지 못했어요/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))

    expect(await screen.findByText('회사는 스마트폰과 메모리 반도체를 주요 제품으로 밝혔어요[1].')).toBeTruthy()
    expect(askCompanyQuestion).toHaveBeenCalledTimes(2)
  })
})
