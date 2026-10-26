import type { Company } from '@/shared/api/companies'

/**
 * 기업 개요 탭의 영역 하나가 받는 값(FS-45~49). 영역은 이 값만 받아 자기 자료를 스스로 불러오고
 * 로딩·오류·빈 결과도 자기 안에서 보여 준다(한 영역이 실패해도 다른 영역은 그대로).
 */
export interface OverviewSectionProps {
  corpCode: string
  company: Company
}
