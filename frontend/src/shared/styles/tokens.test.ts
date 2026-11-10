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

/** WCAG 상대 밝기 대비(#rrggbb) */
function contrast(a: string, b: string): number {
  const luminance = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => {
      const c = parseInt(hex.slice(i, i + 2), 16) / 255
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
    })
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl
  }
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

describe('다크 테마 토큰', () => {
  const light = declarations(':root')
  const dark = declarations(":root[data-theme='dark']")

  it('처음은 밝게라 운영체제 설정(prefers-color-scheme)으로 어두워지는 블록이 없다(#856)', () => {
    expect(tokensCss).not.toContain('prefers-color-scheme')
  })

  it('색을 직접 적은 밝은 토큰은 모두 어두운 값이 있다', () => {
    const literalColors = [...light.entries()]
      .filter(([name, value]) => name.startsWith('--color-') && value.startsWith('#'))
      .map(([name]) => name)
    expect(literalColors.filter((name) => !dark.has(name))).toEqual([])
  })

  it('글자는 세 바탕에서 4.5:1, 입력 경계는 바탕·안쪽 상자에서 3:1, 주색 위 글자는 4.5:1 이상이다', () => {
    const color = (name: string) => dark.get(name) as string
    const backgrounds = ['--color-bg', '--color-bg-subtle', '--color-bg-raised'].map(color)
    for (const text of ['--color-text', '--color-text-muted', '--color-accent', '--color-attention', '--color-danger', '--color-increase']) {
      for (const bg of backgrounds) expect(contrast(color(text), bg), `${text} on ${bg}`).toBeGreaterThanOrEqual(4.5)
    }
    for (const bg of [color('--color-bg'), color('--color-bg-subtle')]) {
      expect(contrast(color('--color-border-strong'), bg)).toBeGreaterThanOrEqual(3)
    }
    expect(contrast(color('--color-primary-text'), color('--color-primary'))).toBeGreaterThanOrEqual(4.5)
  })
})
