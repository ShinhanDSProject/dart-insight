import { wordDiff, type MergedPart } from './wordDiff'

const ELLIPSIS = '…'

/**
 * 카드의 합쳐 보기(3.53): 이전·현재 미리보기를 한 글로 합친다. 화면 표시에만 쓴다.
 * 미리보기는 앞부분 240자라 끝이 잘려 있으면(…) 두 글의 잘린 자리가 달라 끝이 바뀐 것처럼 보인다.
 * 그래서 잘린 글은 앞에 바뀐 곳이 이미 보이면 마지막으로 같은 낱말까지만 보이고 뒤에 …를 붙인다(전체는 원문 비교 창).
 * 바뀐 곳이 끝에만 있으면 지우지 않는다(서버는 처음 달라지는 곳 조금 앞부터 잘라 주므로 첫 변경은 앞쪽에 있다).
 * 같은 낱말이 하나도 없거나 계산하지 못하면 null을 돌려준다(나란히 보기로 보임).
 */
export function mergedPreview(previous: string | null, current: string | null): MergedPart[] | null {
  if (previous === null || current === null) return null
  const diff = wordDiff(previous, current)
  if (diff === null) return null
  const parts = diff.merged
  if (!parts.some((part) => part.kind === 'same' && part.text.trim() !== '')) return null
  const truncated = previous.endsWith(ELLIPSIS) || current.endsWith(ELLIPSIS)
  if (!truncated) return parts
  const isWord = (part: MergedPart) => part.kind === 'same' && part.text.trim() !== ''
  let lastSame = parts.length - 1
  while (lastSame > 0 && !isWord(parts[lastSame])) lastSame--
  if (!parts.slice(0, lastSame).some((part) => part.kind !== 'same')) return parts
  const kept = parts.slice(0, lastSame + 1).map((part) => ({ ...part }))
  const last = kept[kept.length - 1]
  if (!last.text.endsWith(ELLIPSIS)) last.text = `${last.text.trimEnd()} ${ELLIPSIS}`
  return kept
}
