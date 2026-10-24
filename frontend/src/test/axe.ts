import axe from 'axe-core'

/**
 * 접근성 자동 점검(FS-19). 그린 화면 조각을 axe로 검사하고 위반을 규칙·설명·위치로 적어 돌려준다.
 * jsdom은 색과 배치를 계산하지 못하므로 색 대비(color-contrast)는 끄고, 화면 조각만 그리므로 랜드마크 밖 내용(region)도 끈다.
 */
const options: axe.RunOptions = {
  rules: {
    'color-contrast': { enabled: false },
    region: { enabled: false },
  },
}

/** 위반이 없으면 빈 문자열, 있으면 사람이 읽는 목록. `expect(await axeViolations(container)).toBe('')`로 쓴다 */
export async function axeViolations(container: Element): Promise<string> {
  const result = await axe.run(container, options)
  return result.violations
    .map((v) => `${v.id}: ${v.help}\n${v.nodes.map((n) => `  - ${n.target.join(' ')}`).join('\n')}`)
    .join('\n')
}
