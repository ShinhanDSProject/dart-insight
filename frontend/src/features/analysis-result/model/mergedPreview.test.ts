import { describe, expect, it } from 'vitest'
import { mergedPreview } from './mergedPreview'

const render = (parts: { text: string; kind: string }[] | null) =>
  parts?.map((p) => (p.kind === 'same' ? p.text : p.kind === 'removed' ? `[-${p.text}]` : `[+${p.text}]`)).join('')

describe('mergedPreview', () => {
  it('빠진 낱말과 새 낱말을 한 글에 표시한다', () => {
    expect(render(mergedPreview('주당 2,204원을 배당합니다.', '주당 3,000원을 배당합니다.'))).toBe(
      '주당 [-2,204원을][+3,000원을] 배당합니다.',
    )
  })

  it('잘린 미리보기는 앞에 바뀐 곳이 있으면 마지막으로 같은 낱말까지만 보이고 …를 붙인다', () => {
    const parts = mergedPreview('…회사는 3월 말일의 주주에게 배당을 할 수 있다. 사업연도 개시일로…', '…회사는 주주에게 배당을 할 수 있다. 제2항의 분기배당은…')

    expect(render(parts)).toBe('…회사는 [-3월 말일의 ]주주에게 배당을 할 수 있다. …')
  })

  it('잘린 미리보기라도 바뀐 곳이 끝에만 있으면 지우지 않는다', () => {
    const parts = mergedPreview('…주당 현금배당금은 2,204원…', '…주당 현금배당금은 3,000원…')

    expect(render(parts)).toBe('…주당 현금배당금은 [-2,204원…][+3,000원…]')
  })

  it('한쪽이 없거나 같은 낱말이 없으면 합치지 않는다', () => {
    expect(mergedPreview(null, '새 글')).toBeNull()
    expect(mergedPreview('전혀 다른 글', '완전히 새로운 문장')).toBeNull()
  })
})
