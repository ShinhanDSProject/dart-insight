/** 브라우저 탭 제목의 서비스 이름. index.html의 기본 제목과 같다 */
export const APP_TITLE = 'DART Insight'

/**
 * 화면의 탭 제목(WCAG 2.4.2). 앞에서부터 '·'로 잇고 끝에 서비스 이름을 붙인다.
 * 비었거나 null인 조각은 빼고, 남는 조각이 없으면 서비스 이름만 쓴다.
 * 예: ['삼성전자 보고서 고르기'] → '삼성전자 보고서 고르기 · DART Insight'
 */
export function pageTitle(parts: ReadonlyArray<string | null | undefined>): string {
  const kept = parts.map((part) => part?.trim() ?? '').filter((part) => part !== '')
  return [...kept, APP_TITLE].join(' · ')
}

/**
 * 한 기업을 다루는 화면의 탭 제목. 기업 정보를 불러오기 전(null)에는 화면 이름만 쓴다.
 * 예: ('삼성전자', '보고서 고르기') → '삼성전자 보고서 고르기 · DART Insight'
 */
export function companyPageTitle(corpName: string | null, screen: string): string {
  return pageTitle([corpName === null ? screen : `${corpName} ${screen}`])
}
