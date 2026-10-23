import type { TableCell } from '@/shared/api/textChanges'
import { DataTable } from '@/shared/ui'

/**
 * 원문 표(4.2에서 읽은 셀). 머리글(TH)·병합(colspan·rowspan)을 그대로 보여 준다.
 * 머리글의 방향은 원문에 없으므로, 첫 줄 머리글은 열 머리글, 그 아래 첫 칸 머리글은 행 머리글로 본다.
 */
export function TableView({ rows, caption }: { rows: TableCell[][]; caption: string }) {
  return (
    <DataTable caption={caption} density="compact">
      <tbody>
        {rows.map((row, r) => (
          <tr key={r}>
            {row.map((cell, c) =>
              cell.header ? (
                <th key={c} scope={headerScope(r, c)} colSpan={cell.colspan} rowSpan={cell.rowspan}>
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
    </DataTable>
  )
}

function headerScope(row: number, column: number): 'col' | 'row' | undefined {
  if (row === 0) return 'col'
  return column === 0 ? 'row' : undefined
}
