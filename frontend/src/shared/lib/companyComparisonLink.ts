/**
 * 여러 기업 나란히 보기 주소 약속(FS-56, #534).
 * 첫 화면 관심 기업과 기업 비교 화면이 서로 직접 import하지 않도록(DIR-4) 공통 수 제한과 주소 조립을 shared에 둔다.
 */

export const MIN_COMPARE_COMPANIES = 2
export const MAX_COMPARE_COMPANIES = 4

const CORP_CODE = /^\d{8}$/

/** 8자리 고유번호만 겹치지 않게 앞에서부터 최대 4곳까지 추린다 */
export function pickComparisonCorps(corpCodes: readonly string[]): string[] {
  const valid = corpCodes.map((code) => code.trim()).filter((code) => CORP_CODE.test(code))
  return [...new Set(valid)].slice(0, MAX_COMPARE_COMPANIES)
}

/** 2곳 이상일 때만 기업 나란히 보기 주소를 돌려준다 */
export function companyComparisonPath(corpCodes: readonly string[]): string | null {
  const picked = pickComparisonCorps(corpCodes)
  if (picked.length < MIN_COMPARE_COMPANIES) return null
  return `/compare/companies?corps=${picked.join(',')}`
}
