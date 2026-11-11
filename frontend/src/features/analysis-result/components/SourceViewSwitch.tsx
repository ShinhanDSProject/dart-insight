import { SegmentedControl } from '@/shared/ui'
import type { SourceView } from '../model/resultParams'

const OPTIONS: readonly { value: SourceView; label: string }[] = [
  { value: 'source', label: '원문 읽기' },
  { value: 'text', label: '바뀐 곳' },
]

/**
 * 원문 탭 맨 위의 보기 전환(사용자 결정 2026-11-11). 원문 읽기(?tab=source)와 바뀐 곳(?tab=text, 문장 변경 전체 목록)을 오간다.
 * 원문 탭을 누르면 원문 읽기가 먼저 보인다.
 */
export function SourceViewSwitch({ value, onChange }: { value: SourceView; onChange: (view: SourceView) => void }) {
  return (
    <div className="source-view-switch">
      <SegmentedControl aria-label="원문 보기" options={OPTIONS} value={value} onChange={onChange} />
    </div>
  )
}
