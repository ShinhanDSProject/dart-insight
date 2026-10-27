/**
 * 원문 확인의 긴 항목을 소제목별로 나눠 보이는 규칙(#396). 연결재무제표 주석처럼 '1. 일반적 사항', '2. …'으로 번호가 이어지는
 * 소제목이 있는 긴 항목만 나누고, 짧은 항목이나 번호가 이어지지 않는 항목은 한 덩어리로 둔다.
 */
import type { SourceBlock } from '@/shared/api/documents'

/** 블록이 이만큼보다 적으면 나누지 않는다(짧은 항목은 한 화면에 다 보는 편이 낫다) */
export const PART_MIN_BLOCKS = 40
/** 소제목이 이만큼보다 적으면 나누지 않는다 */
export const PART_MIN_HEADINGS = 3
/** 소제목으로 보는 문단의 최대 글자 수(문장으로 끝나는 긴 문단은 소제목이 아니다) */
const HEADING_MAX_LENGTH = 50
const HEADING = /^\s*(\d{1,3})\.\s+(\S.*)$/

export interface SourcePart {
  /** 목록에 보일 이름. 소제목 앞부분은 '처음 부분' */
  title: string
  blocks: SourceBlock[]
}

function headingNumber(block: SourceBlock): number | null {
  if (block.type !== 'PARAGRAPH') return null
  const text = block.text.trim()
  if (text.length > HEADING_MAX_LENGTH || /[다요]\.$/.test(text)) return null
  const found = HEADING.exec(text)
  return found ? Number(found[1]) : null
}

/**
 * 블록을 소제목별로 나눈다. 소제목은 1부터 하나씩 이어지는 번호('1.', '2.', …)로 시작하는 짧은 문단이다.
 * 번호가 건너뛰거나 되돌아가는 문단(본문 안 목록)은 소제목으로 보지 않는다. 나누지 않으면 한 덩어리 하나를 돌려준다.
 */
export function splitParts(blocks: SourceBlock[]): SourcePart[] {
  const whole = [{ title: '', blocks }]
  if (blocks.length < PART_MIN_BLOCKS) return whole
  const starts: number[] = []
  let next = 1
  blocks.forEach((block, index) => {
    if (headingNumber(block) === next) {
      starts.push(index)
      next += 1
    }
  })
  if (starts.length < PART_MIN_HEADINGS) return whole
  const parts: SourcePart[] = []
  if (starts[0] > 0) parts.push({ title: '처음 부분', blocks: blocks.slice(0, starts[0]) })
  starts.forEach((start, i) => {
    const end = starts[i + 1] ?? blocks.length
    parts.push({ title: blocks[start].text.trim(), blocks: blocks.slice(start, end) })
  })
  return parts
}

/** 근거 블록이 든 조각의 순번. 없으면 0(첫 조각) */
export function partIndexOf(parts: SourcePart[], blockNo: number | null): number {
  if (blockNo === null) return 0
  const index = parts.findIndex((part) => part.blocks.some((block) => block.blockNo === blockNo))
  return index < 0 ? 0 : index
}
