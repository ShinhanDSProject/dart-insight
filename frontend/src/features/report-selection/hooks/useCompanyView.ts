import { useQueryParams } from '@/shared/hooks/useQueryParams'
import { companyViewChanges, parseCompanyView, type CompanyView } from '../model/companyView'

/** 기업 화면의 맨 위 탭(주소 ?view=overview|compare, ST-6) */
export function useCompanyView(): { view: CompanyView; selectView: (view: CompanyView) => void } {
  const { params, update } = useQueryParams()
  return {
    view: parseCompanyView(params),
    selectView: (view) => update(companyViewChanges(view)),
  }
}
