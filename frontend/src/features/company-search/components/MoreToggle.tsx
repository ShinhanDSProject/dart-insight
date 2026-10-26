import { Button } from '@/shared/ui'

/** 첫 화면 목록 아래 '더 보기(N건)'·'접기' 버튼(#374). 펼치는 목록의 id를 aria-controls로 잇는다 */
export function MoreToggle({
  controls,
  expanded,
  hiddenCount,
  unit,
  onToggle,
}: {
  controls: string
  expanded: boolean
  hiddenCount: number
  /** 남은 수 뒤에 붙는 말(예: '건', '개') */
  unit: string
  onToggle: () => void
}) {
  return (
    <Button variant="link" className="more-toggle" aria-expanded={expanded} aria-controls={controls} onClick={onToggle}>
      {expanded ? '접기' : `더 보기 (${hiddenCount}${unit})`}
    </Button>
  )
}
