import type { TableCell } from '../../api/textChanges'

/** 원문 표(4.2에서 읽은 셀). 머리글(TH)·병합(colspan·rowspan)을 그대로 보여 준다. */
export function TableView({ rows, caption }: { rows: TableCell[][]; caption: string }) {
  return (
    <div className="table-scroll source-table">
      <table className="data-table">
        <caption className="visually-hidden">{caption}</caption>
        <tbody>
          {rows.map((row, r) => (
            <tr key={r}>
              {row.map((cell, c) =>
                cell.header ? (
                  <th key={c} scope="col" colSpan={cell.colspan} rowSpan={cell.rowspan}>
                    {cell.text}
                  </th>
                ) : (
                  <td key={c} colSpan={cell.colspan} rowSpan={cell.rowspan}>
                    {cell.text}
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
