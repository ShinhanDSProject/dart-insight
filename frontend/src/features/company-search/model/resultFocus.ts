/**
 * 검색 결과 키보드 이동(FS-32). 지금 초점과 누른 키로 다음 초점을 정한다(순수 함수).
 * 입력창에서 ↓는 첫 결과로, 결과에서 ↑↓는 이웃 결과로, 첫 결과의 ↑와 Esc는 입력창으로 간다. Home·End는 처음·끝 결과.
 * Enter는 결과 링크가 스스로 연다.
 */

/** 'input'이면 입력창, 숫자면 그 순서의 결과 */
export type ResultFocus = 'input' | number

/** 초점을 옮길 곳. 키를 처리하지 않으면 null */
export function nextResultFocus(current: ResultFocus, key: string, count: number): ResultFocus | null {
  if (count === 0) return null
  if (current === 'input') return key === 'ArrowDown' ? 0 : null
  switch (key) {
    case 'ArrowDown':
      return Math.min(current + 1, count - 1)
    case 'ArrowUp':
      return current === 0 ? 'input' : current - 1
    case 'Home':
      return 0
    case 'End':
      return count - 1
    case 'Escape':
      return 'input'
    default:
      return null
  }
}
