/**
 * 두 글의 낱말 단위 차이(3.4 근거 상세의 강조 표시용). 화면 표시에만 쓰고 결과 판단에는 쓰지 않는다.
 * 너무 긴 글은 계산하지 않고 null을 돌려준다(강조 없이 전체 글을 보여 줌).
 */
export interface DiffPart {
  text: string
  changed: boolean
}

export interface WordDiff {
  previous: DiffPart[]
  current: DiffPart[]
}

const MAX_CELLS = 400_000

function tokens(text: string): string[] {
  return text.match(/\s+|[^\s]+/g) ?? []
}

function merge(parts: DiffPart[]): DiffPart[] {
  const merged: DiffPart[] = []
  for (const part of parts) {
    const last = merged[merged.length - 1]
    if (last && last.changed === part.changed) last.text += part.text
    else merged.push({ ...part })
  }
  return merged
}

export function wordDiff(previous: string, current: string): WordDiff | null {
  const a = tokens(previous)
  const b = tokens(current)
  if ((a.length + 1) * (b.length + 1) > MAX_CELLS) return null
  // 가장 긴 공통 부분열(LCS) 표
  const width = b.length + 1
  const lcs = new Uint32Array((a.length + 1) * width)
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lcs[i * width + j] = a[i] === b[j] ? lcs[(i + 1) * width + j + 1] + 1 : Math.max(lcs[(i + 1) * width + j], lcs[i * width + j + 1])
    }
  }
  const left: DiffPart[] = []
  const right: DiffPart[] = []
  let i = 0
  let j = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      left.push({ text: a[i], changed: false })
      right.push({ text: b[j], changed: false })
      i++
      j++
    } else if (lcs[(i + 1) * width + j] >= lcs[i * width + j + 1]) {
      left.push({ text: a[i], changed: true })
      i++
    } else {
      right.push({ text: b[j], changed: true })
      j++
    }
  }
  for (; i < a.length; i++) left.push({ text: a[i], changed: true })
  for (; j < b.length; j++) right.push({ text: b[j], changed: true })
  return { previous: merge(left), current: merge(right) }
}
