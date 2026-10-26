import type { DisclosureKeyItem } from '@/shared/api/disclosures'

/**
 * 핵심 수치 한 항목의 표시 글(FS-51). 값은 원문 표기 그대로 두고 단위만 붙인다(새 숫자를 만들지 않음, ADR-0018).
 * %는 값에 붙이고, 원·주·원/주는 한 칸 띄운다
 */
export function keyItemText(item: Pick<DisclosureKeyItem, 'value' | 'unit'>): string {
  if (item.unit === null) return item.value
  return item.unit === '%' ? `${item.value}%` : `${item.value} ${item.unit}`
}
