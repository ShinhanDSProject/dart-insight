import { describe, expect, it } from 'vitest'
import { dartViewerUrl, verifiedDartUrl } from './dart'

describe('dart', () => {
  it('접수번호로 원문 주소를 만든다', () => {
    expect(dartViewerUrl('20260814000001')).toBe('https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20260814000001')
  })

  it('접수번호가 14자리 숫자가 아니면 주소를 만들지 않는다', () => {
    expect(dartViewerUrl('2026081400000')).toBeNull()
    expect(dartViewerUrl('2026081400000a')).toBeNull()
  })

  it('다른 보고서를 가리키는 주소는 쓰지 않는다', () => {
    const rceptNo = '20260814000001'
    expect(verifiedDartUrl(rceptNo, 'https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20260814000001')).toBe(
      'https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20260814000001',
    )
    expect(verifiedDartUrl(rceptNo, 'https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20250814000001')).toBeNull()
    expect(verifiedDartUrl(rceptNo, 'https://example.com/?rcpNo=20260814000001')).toBeNull()
    expect(verifiedDartUrl(rceptNo, null)).toBeNull()
  })
})
