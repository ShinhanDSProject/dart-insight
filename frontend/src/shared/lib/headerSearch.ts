/** 화면 안의 '기업 변경'(#655)이 상단 바 검색창을 열어 달라고 보내는 이벤트. Layout이 받아 좁은 화면 메뉴를 열고 검색창에 초점을 옮긴다 */
export const OPEN_HEADER_SEARCH_EVENT = 'dart-insight:open-header-search'

export function openHeaderSearch(): void {
  window.dispatchEvent(new Event(OPEN_HEADER_SEARCH_EVENT))
}
