import { describe, expect, it } from 'vitest'
import { SERVICE_NOTICE } from './serviceNotice'

describe('SERVICE_NOTICE', () => {
  it('생성형 AI 사용, 투자 조언 아님, 출처를 모두 알린다', () => {
    const text = SERVICE_NOTICE.join(' ')
    expect(text).toContain('생성형 AI')
    expect(text).toContain("'AI 생성'")
    expect(text).toContain('투자 조언이 아니')
    expect(text).toContain('DART')
  })
})
