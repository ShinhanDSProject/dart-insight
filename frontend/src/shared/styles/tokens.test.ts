import { describe, expect, it } from 'vitest'
import tokensCss from './tokens.css?raw'

/** 선택자 바로 뒤 { ... } 안의 '--이름: 값' 목록 */
function declarations(selector: string): Map<string, string> {
  const start = tokensCss.indexOf(`${selector} {`)
  if (start < 0) throw new Error(`${selector} 블록이 없어요`)
  const body = tokensCss.slice(start + selector.length + 2, tokensCss.indexOf('}', start))
  const map = new Map<string, string>()
  for (const match of body.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
    map.set(match[1], match[2].trim())
  }
  return map
}

describe('다크 테마 토큰', () => {
  const light = declarations(':root')
  const dark = declarations(":root[data-theme='dark']")
  const system = declarations(":root:not([data-theme='light'])")

  it('직접 고른 어둡게와 시스템 어둡게는 같은 값을 쓴다', () => {
    expect([...system.entries()]).toEqual([...dark.entries()])
  })

  it('색을 직접 적은 밝은 토큰은 모두 어두운 값이 있다', () => {
    const literalColors = [...light.entries()]
      .filter(([name, value]) => name.startsWith('--color-') && value.startsWith('#'))
      .map(([name]) => name)
    expect(literalColors.filter((name) => !dark.has(name))).toEqual([])
  })
})
