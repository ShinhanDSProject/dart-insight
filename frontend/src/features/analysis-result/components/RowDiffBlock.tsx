import type { ComparedRowDiff } from '@/shared/api/textChanges'
import { formatCount } from '../model/textFilter'
import { cellText, hiddenChangedRows, MISSING_ROW_NOTE, rowCountItems, visibleChangedRows } from '../model/rowDiff'

/** 표 변경 카드의 행 비교 결과(3.30): 행 건수와 바뀐 행의 칸. 표 전체를 삭제·추가처럼 보이지 않게 양쪽 글 대신 둔다 */
export function RowDiffBlock({ diff }: { diff: ComparedRowDiff }) {
  const hidden = hiddenChangedRows(diff)
  return (
    <div className="row-diff">
      <dl className="row-diff__counts">
        {rowCountItems(diff.counts).map(({ label, count }) => (
          <div key={label} className="row-diff__count">
            <dt>{label}</dt>
            <dd>{formatCount(count)}</dd>
          </div>
        ))}
      </dl>
      {diff.changedRows.length > 0 && (
        <ul className="row-diff__rows">
          {visibleChangedRows(diff).map((row) => (
            <li key={row.key} className="row-diff__row">
              <strong className="row-diff__key">{row.key}</strong>
              <ul className="row-diff__cells">
                {row.cells.map((cell) => (
                  <li key={cell.column} className="row-diff__cell">
                    <span className="row-diff__column">{cell.column}</span>
                    <span className="row-diff__values">
                      {cellText(cell.previous)} → {cellText(cell.current)}
                    </span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
      {hidden > 0 && <p className="panel__note">바뀐 행 {formatCount(hidden)}개가 더 있어요. 표 전체는 '원문 비교'에서 볼 수 있어요.</p>}
      <p className="panel__note">
        '{diff.keyColumn}' 값으로 행을 짝지었어요. {MISSING_ROW_NOTE}
      </p>
    </div>
  )
}
