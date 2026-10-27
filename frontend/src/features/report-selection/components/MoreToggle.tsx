import { Button } from '@/shared/ui'

/**
 * 접힌 목록 아래 '더 보기 (N개)'·'접기' 버튼(design-system.md 4-15). 펼치는 목록·표의 id를 aria-controls로 잇는다.
 * 첫 화면(company-search)에도 같은 모양이 있지만 기능끼리 import하지 않아(DIR-4) 따로 둔다.
 */
export function MoreToggle({
  controls,
  expanded,
  hiddenCount,
  onToggle,
}: {
  controls: string
  expanded: boolean
  hiddenCount: number
  onToggle: () => void
}) {
  return (
    <Button variant="link" aria-expanded={expanded} aria-controls={controls} onClick={onToggle}>
      {expanded ? '접기' : `더 보기 (${hiddenCount}개)`}
    </Button>
  )
}
