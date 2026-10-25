import { formatShare, shares } from '@/shared/lib/compare'
import { cx } from '@/shared/lib/cx'

/**
 * added·modified·deleted: 문장 변경 구성. neutral: 내용은 그대로인 변경(숫자만 바뀜·위치 이동).
 * series-1~4: 좋고 나쁨이 없는 상태 구성(AI 사용 현황)
 */
export type ShareTone = 'added' | 'modified' | 'deleted' | 'neutral' | 'series-1' | 'series-2' | 'series-3' | 'series-4'

export interface ShareSegment {
  label: string
  value: number
  /** 화면에 보이는 건수(예: 269) */
  text: string
  tone: ShareTone
}

/**
 * 구성 비율 막대(FS-3 R11). 0인 조각은 그리지 않고(0보다 크면 최소 2px로 보임), 범례에 이름·건수·비율을 글자로 둔다(색만으로 구분하지 않음).
 * 버튼 안에도 넣을 수 있게 span만 쓴다.
 */
export function ShareBar({ segments, className }: { segments: ShareSegment[]; className?: string }) {
  const percents = shares(segments.map((s) => s.value))
  if (percents.every((p) => p === 0)) return null
  return (
    <span className={cx('share-bar', className)}>
      <span className="share-bar__track" aria-hidden="true">
        {segments.map((segment, i) =>
          percents[i] > 0 ? (
            <span
              key={segment.label}
              className={`share-bar__part share-bar__part--${segment.tone}`}
              style={{ flexGrow: percents[i] }}
            />
          ) : null,
        )}
      </span>
      <span className="share-bar__legend">
        {segments.map((segment, i) => (
          <span key={segment.label} className="share-bar__item">
            <span className={`share-bar__key share-bar__part--${segment.tone}`} aria-hidden="true" />
            {segment.label} {segment.text}
            <span className="share-bar__share">({formatShare(percents[i])})</span>
          </span>
        ))}
      </span>
    </span>
  )
}
