/**
 * 원문 섹션 제목을 화면에 보이기 좋게 바꾼다(#210). 저장값·거르기 값은 그대로 두고 표시만 바꾼다.
 * - '반 기 보 고 서'처럼 한글 한 글자씩 띄운 제목은 붙인다(공시 표지 서식)
 * - 파서가 붙인 '(목차 밖 본문)'은 '표지·목차 앞 내용'으로 보인다
 */
const OUTSIDE_TOC = '(목차 밖 본문)'
const SPACED_HANGUL = /^[가-힣](?: [가-힣])+$/

export function displaySectionTitle(title: string): string {
  const trimmed = title.trim()
  if (trimmed === OUTSIDE_TOC) return '표지·목차 앞 내용'
  if (SPACED_HANGUL.test(trimmed)) return trimmed.replaceAll(' ', '')
  return title
}

/** 'A > B' 꼴 경로의 각 제목을 바꾼다 */
export function displaySectionPath(path: string): string {
  return path
    .split(' > ')
    .map(displaySectionTitle)
    .join(' > ')
}
