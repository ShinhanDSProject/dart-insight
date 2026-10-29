import { match } from 'ts-pattern'
import type { TableCell } from '@/shared/api/textChanges'
import { formatCount } from './overview'

/**
 * 원문 비교 창(3.4)에서 두 표(previous.table·current.table)의 바뀐 셀·행을 짝짓는 순수 함수(#524).
 * 화면 강조용이며 분석 결과 수치 판단에는 쓰지 않는다.
 * 너무 큰 표는 계산하지 않고 null을 돌려준다(강조 없이 원래 표를 보여 줌).
 */
export type TableRowDiff =
  | { status: 'matched'; changedCols: ReadonlySet<number> }
  | { status: 'added' }
  | { status: 'removed' }

export interface TableSideDiff {
  rows: TableRowDiff[]
}

export interface TableDiff {
  previous: TableSideDiff
  current: TableSideDiff
  changedCells: number
  addedRows: number
  removedRows: number
}

const MAX_TOTAL_CELLS = 2_500
const MAX_LCS_MATRIX = 40_000

function normalizeCell(text: string): string {
  return text.normalize('NFKC').trim().replace(/\s+/g, ' ')
}

function countCells(rows: TableCell[][]): number {
  return rows.reduce((sum, row) => sum + row.length, 0)
}

function leadingHeaderCount(rows: TableCell[][]): number {
  let count = 0
  while (count < rows.length && rows[count].length > 0 && rows[count].every((cell) => cell.header)) {
    count += 1
  }
  return count
}

function disambiguatedRowKeys(rows: TableCell[][]): string[] {
  const seen = new Map<string, number>()
  return rows.map((row) => {
    const base = normalizeCell(row[0]?.text ?? '')
    if (base.length === 0) return ''
    const next = (seen.get(base) ?? 0) + 1
    seen.set(base, next)
    return `${base}#${next}`
  })
}

function compareRowCells(
  prevRow: TableCell[],
  currRow: TableCell[],
): { prevChanged: Set<number>; currChanged: Set<number>; changedCount: number } {
  const prevChanged = new Set<number>()
  const currChanged = new Set<number>()
  const maxCols = Math.max(prevRow.length, currRow.length)
  let changedCount = 0

  for (let c = 0; c < maxCols; c += 1) {
    if (c >= currRow.length) {
      prevChanged.add(c)
      changedCount += 1
    } else if (c >= prevRow.length) {
      currChanged.add(c)
      changedCount += 1
    } else if (normalizeCell(prevRow[c].text) !== normalizeCell(currRow[c].text)) {
      prevChanged.add(c)
      currChanged.add(c)
      changedCount += 1
    }
  }
  return { prevChanged, currChanged, changedCount }
}

/** LCS로 짝지은 행 인덱스 쌍 [prevIdx, currIdx] 목록 */
function matchRowPairsByKey(prevKeys: string[], currKeys: string[]): [number, number][] {
  if ((prevKeys.length + 1) * (currKeys.length + 1) > MAX_LCS_MATRIX) return []
  const width = currKeys.length + 1
  const lcs = new Uint32Array((prevKeys.length + 1) * width)

  for (let i = prevKeys.length - 1; i >= 0; i -= 1) {
    for (let j = currKeys.length - 1; j >= 0; j -= 1) {
      const equal = prevKeys[i].length > 0 && prevKeys[i] === currKeys[j]
      lcs[i * width + j] = equal
        ? lcs[(i + 1) * width + j + 1] + 1
        : Math.max(lcs[(i + 1) * width + j], lcs[i * width + j + 1])
    }
  }

  const pairs: [number, number][] = []
  let i = 0
  let j = 0
  while (i < prevKeys.length && j < currKeys.length) {
    if (prevKeys[i].length > 0 && prevKeys[i] === currKeys[j]) {
      pairs.push([i, j])
      i += 1
      j += 1
    } else if (lcs[(i + 1) * width + j] >= lcs[i * width + j + 1]) {
      i += 1
    } else {
      j += 1
    }
  }
  return pairs
}

export function tableDiff(previousRows: TableCell[][], currentRows: TableCell[][]): TableDiff | null {
  if (previousRows.length === 0 || currentRows.length === 0) return null
  if (countCells(previousRows) + countCells(currentRows) > MAX_TOTAL_CELLS) return null

  const headerRows = Math.min(leadingHeaderCount(previousRows), leadingHeaderCount(currentRows))
  const prevDiffs: TableRowDiff[] = new Array(previousRows.length)
  const currDiffs: TableRowDiff[] = new Array(currentRows.length)
  let changedCells = 0
  let addedRows = 0
  let removedRows = 0

  for (let r = 0; r < headerRows; r += 1) {
    const compared = compareRowCells(previousRows[r], currentRows[r])
    prevDiffs[r] = { status: 'matched', changedCols: compared.prevChanged }
    currDiffs[r] = { status: 'matched', changedCols: compared.currChanged }
    changedCells += compared.changedCount
  }

  const prevBody = previousRows.slice(headerRows)
  const currBody = currentRows.slice(headerRows)
  const keyPairs = matchRowPairsByKey(disambiguatedRowKeys(prevBody), disambiguatedRowKeys(currBody))

  if (keyPairs.length > 0) {
    const matchedPrev = new Map<number, number>()
    const matchedCurr = new Set<number>()
    for (const [pIdx, cIdx] of keyPairs) {
      matchedPrev.set(pIdx, cIdx)
      matchedCurr.add(cIdx)
    }

    for (let p = 0; p < prevBody.length; p += 1) {
      const c = matchedPrev.get(p)
      if (c === undefined) {
        prevDiffs[headerRows + p] = { status: 'removed' }
        removedRows += 1
      } else {
        const compared = compareRowCells(prevBody[p], currBody[c])
        prevDiffs[headerRows + p] = { status: 'matched', changedCols: compared.prevChanged }
        currDiffs[headerRows + c] = { status: 'matched', changedCols: compared.currChanged }
        changedCells += compared.changedCount
      }
    }

    for (let c = 0; c < currBody.length; c += 1) {
      if (!matchedCurr.has(c)) {
        currDiffs[headerRows + c] = { status: 'added' }
        addedRows += 1
      }
    }
  } else {
    const shared = Math.min(prevBody.length, currBody.length)
    for (let k = 0; k < shared; k += 1) {
      const compared = compareRowCells(prevBody[k], currBody[k])
      prevDiffs[headerRows + k] = { status: 'matched', changedCols: compared.prevChanged }
      currDiffs[headerRows + k] = { status: 'matched', changedCols: compared.currChanged }
      changedCells += compared.changedCount
    }
    for (let p = shared; p < prevBody.length; p += 1) {
      prevDiffs[headerRows + p] = { status: 'removed' }
      removedRows += 1
    }
    for (let c = shared; c < currBody.length; c += 1) {
      currDiffs[headerRows + c] = { status: 'added' }
      addedRows += 1
    }
  }

  return {
    previous: { rows: prevDiffs },
    current: { rows: currDiffs },
    changedCells,
    addedRows,
    removedRows,
  }
}

/** 표 비교 요약 안내 문구. 바뀐 셀·행이 하나도 없으면 null */
export function tableDiffSummaryLabel(diff: TableDiff | null): string | null {
  if (diff === null) return null
  const parts: string[] = []
  if (diff.changedCells > 0) parts.push(`바뀐 표 칸 ${formatCount(diff.changedCells)}곳`)
  if (diff.addedRows > 0) parts.push(`추가된 행 ${formatCount(diff.addedRows)}줄`)
  if (diff.removedRows > 0) parts.push(`삭제된 행 ${formatCount(diff.removedRows)}줄`)
  if (parts.length === 0) return null
  return `${parts.join(' · ')}을 표시했어요.`
}

export function rowStatusBadgeLabel(rowDiff: TableRowDiff | undefined): string | null {
  if (rowDiff === undefined) return null
  return match(rowDiff)
    .with({ status: 'matched' }, () => null)
    .with({ status: 'added' }, () => '추가 행')
    .with({ status: 'removed' }, () => '삭제 행')
    .exhaustive()
}
