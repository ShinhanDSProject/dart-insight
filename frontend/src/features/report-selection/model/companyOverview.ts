import type { CompanyOverview, CorpClass } from '@/shared/api/companies'
import { formatDate } from '@/shared/lib/reportLabels'

/** OpenDART 법인구분(corp_cls) 이름. OpenDART 개발가이드 기업개황의 값 설명을 따른다 */
const corpClassLabels: Record<CorpClass, string> = {
  Y: '유가증권시장',
  K: '코스닥',
  N: '코넥스',
  E: '기타',
}

/** 법인구분 이름. 모르는 값은 원문 그대로, 없으면 null */
export function corpClassLabel(corpClass: string | null): string | null {
  if (corpClass === null) return null
  return corpClassLabels[corpClass as CorpClass] ?? corpClass
}

/** 결산월 12 → '12월' */
export function accountingMonthLabel(month: number | null): string | null {
  return month === null ? null : `${month}월`
}

const SCHEME = /^[a-z][a-z\d+.-]*:/i
const HTTP_SCHEME = /^https?:\/\//i

/**
 * OpenDART 홈페이지 원문을 열 수 있는 주소로 바꾼다. 'www.samsung.com/sec'처럼 http(s)://가 없으면 http://를 붙인다
 * (사이트가 https로 넘겨 준다). http(s)가 아닌 주소(javascript: 등)나 공백이 든 값은 링크로 만들지 않는다.
 */
export function externalHref(url: string | null): string | null {
  const text = url?.trim() ?? ''
  if (text === '' || /\s/.test(text)) return null
  if (HTTP_SCHEME.test(text)) return text
  if (SCHEME.test(text) && !/^[^:/]+:\d+/.test(text)) return null
  return `http://${text}`
}

/** 개황 카드 한 줄. value가 null이면 OpenDART에 값이 없다는 뜻이다 */
export interface OverviewFact {
  label: string
  value: string | null
  /** 바깥 링크로 열 주소(홈페이지) */
  href?: string | null
}

/** 개황 카드에 보여 줄 줄(투자자가 보는 순서). 값은 OpenDART 원문이고 날짜·월만 읽기 쉽게 바꾼다 */
export function overviewFacts(overview: CompanyOverview): OverviewFact[] {
  return [
    { label: '정식명칭', value: overview.corpName },
    { label: '영문명칭', value: overview.corpNameEng },
    { label: '대표자', value: overview.ceoName },
    { label: '법인구분', value: corpClassLabel(overview.corpClass) },
    { label: '종목코드', value: overview.stockCode },
    { label: '업종코드', value: overview.indutyCode },
    { label: '설립일', value: overview.establishedDate === null ? null : formatDate(overview.establishedDate) },
    { label: '결산월', value: accountingMonthLabel(overview.accountingMonth) },
    { label: '홈페이지', value: overview.homepageUrl, href: externalHref(overview.homepageUrl) },
    { label: 'IR 홈페이지', value: overview.irUrl, href: externalHref(overview.irUrl) },
    { label: '주소', value: overview.address },
    { label: '전화번호', value: overview.phoneNumber },
  ]
}
