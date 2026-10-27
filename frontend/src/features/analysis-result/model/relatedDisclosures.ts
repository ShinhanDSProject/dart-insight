import { match } from 'ts-pattern'
import type { DisclosureTiming, MatchedField, RelatedDisclosure } from '@/shared/api/textChanges'

/** 처음에 펼쳐 보이는 관련 수시공시 수(FS-54 AC11). '내용 일치'는 이 수를 넘어도 모두 보인다 */
export const RELATED_VISIBLE_COUNT = 5

export function timingLabel(timing: DisclosureTiming): string {
  return match(timing)
    .with('DURING', () => '보고 기간 중')
    .with('AFTER', () => '기간 후~제출 전')
    .exhaustive()
}

function fieldLabel(field: MatchedField): string {
  return match(field)
    .with('NEW_SHARES', () => '신주 수')
    .with('PLAINTIFF', () => '원고')
    .with('CASE_NAME', () => '사건 명칭')
    .with('TARGET_COMPANY', () => '대상 회사')
    .exhaustive()
}

/** 연결 강도 표시. STRONG은 일치한 값 종류를 함께 적는다(예: '내용 일치(신주 수)') */
export function matchLevelLabel(item: Pick<RelatedDisclosure, 'matchLevel' | 'matchedFields'>): string {
  return match(item.matchLevel)
    .with('STRONG', () =>
      item.matchedFields.length === 0 ? '내용 일치' : `내용 일치(${item.matchedFields.map(fieldLabel).join('·')})`,
    )
    .with('TYPE_ONLY', () => '같은 종류')
    .exhaustive()
}

export interface RelatedSplit {
  shown: RelatedDisclosure[]
  /** 'n건 더 보기'로 접는 '같은 종류' 공시 */
  hidden: RelatedDisclosure[]
}

/**
 * 서버가 준 순서(STRONG 먼저, 접수일 최근)를 그대로 두고 앞에서 5건만 보인다.
 * '내용 일치'가 5건을 넘으면 모두 보이고, 접는 것은 나머지 '같은 종류'뿐이다.
 */
export function splitRelated(items: RelatedDisclosure[], visible = RELATED_VISIBLE_COUNT): RelatedSplit {
  const strong = items.filter((item) => item.matchLevel === 'STRONG').length
  const cut = Math.max(visible, strong)
  return { shown: items.slice(0, cut), hidden: items.slice(cut) }
}
