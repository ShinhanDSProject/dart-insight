import type { CompanyOverview } from '@/shared/api/companies'

/**
 * 2026-10-26 OpenDART 기업개황(company.json)에서 삼성전자(00126380)로 받은 값을 API 모양으로 옮긴 것.
 * 주소의 두 칸 공백과 빈 ir_url(null)도 원문 그대로다(backend CompanyJson.SAMSUNG과 같은 응답).
 */
export const samsungOverview: CompanyOverview = {
  corpCode: '00126380',
  available: true,
  corpName: '삼성전자(주)',
  corpNameEng: 'SAMSUNG ELECTRONICS CO,.LTD',
  stockName: '삼성전자',
  stockCode: '005930',
  ceoName: '전영현, 노태문',
  corpClass: 'Y',
  indutyCode: '264',
  establishedDate: '1969-01-13',
  accountingMonth: 12,
  homepageUrl: 'www.samsung.com/sec',
  irUrl: null,
  address: '경기도 수원시 영통구  삼성로 129 (매탄동)',
  phoneNumber: '02-2255-0114',
  fetchedAt: '2026-10-26T10:15:30',
  refreshError: null,
}
