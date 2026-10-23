/** DART 원문 주소. 접수번호(14자리)로 해당 보고서를 연다. */
const VIEWER = 'https://dart.fss.or.kr/dsaf001/main.do?rcpNo='

export function isReceiptNo(value: string): boolean {
  return /^\d{14}$/.test(value)
}

export function dartViewerUrl(rceptNo: string): string | null {
  return isReceiptNo(rceptNo) ? `${VIEWER}${rceptNo}` : null
}

/**
 * 서버가 준 원문 주소가 이 보고서의 접수번호를 가리키는지 확인한다.
 * 다르면 다른 보고서로 잘못 이동하지 않도록 링크를 쓰지 않는다.
 */
export function verifiedDartUrl(rceptNo: string, dartUrl: string | null | undefined): string | null {
  const expected = dartViewerUrl(rceptNo)
  return expected !== null && dartUrl === expected ? expected : null
}
