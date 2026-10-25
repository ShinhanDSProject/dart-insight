import type { NumberChanges } from '../model/numberChanges'

/**
 * '숫자만 바뀜' 카드의 '바뀐 숫자' 줄(3.3, #303). 예: 230개 → 309개 · 33개 → 36개 외 2개.
 * 화살표·가운뎃점은 읽지 않고, 스크린리더에는 '이전 230개, 현재 309개'로 읽힌다.
 */
export function NumberChangesLine({ changes }: { changes: NumberChanges }) {
  return (
    <div className="number-changes">
      <span className="number-changes__label" aria-hidden="true">
        바뀐 숫자
      </span>
      <ul className="number-changes__list" aria-label="바뀐 숫자">
        {changes.pairs.map((pair, index) => (
          <li key={index} className="number-changes__pair">
            {index > 0 && (
              <span className="number-changes__sep" aria-hidden="true">
                ·
              </span>
            )}
            <span className="visually-hidden">이전 </span>
            <span className="number-changes__before">{pair.before}</span>
            <span className="number-changes__arrow" aria-hidden="true">
              →
            </span>
            <span className="visually-hidden">, 현재 </span>
            <span className="number-changes__after">{pair.after}</span>
          </li>
        ))}
        {changes.rest > 0 && <li className="number-changes__rest">외 {changes.rest}개</li>}
      </ul>
    </div>
  )
}
