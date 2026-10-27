import type {
  DisclosureSignalItem,
  DisclosureSignalKind,
  DisclosureSignalKindCount,
  DisclosureSignals,
} from '@/shared/api/disclosureSignals'

/** 종류 하나의 요약 줄. 0건(none)과 확인하지 못함(unavailable)을 나눈다 */
export type SignalKindLine =
  | { status: 'found'; kind: DisclosureSignalKind; label: string; count: number }
  | { status: 'none'; kind: DisclosureSignalKind; label: string }
  | { status: 'unavailable'; kind: DisclosureSignalKind; label: string }

export function kindLine(kind: DisclosureSignalKindCount): SignalKindLine {
  if (kind.status === 'UNAVAILABLE' || kind.count === null) {
    return { status: 'unavailable', kind: kind.kind, label: kind.label }
  }
  return kind.count > 0
    ? { status: 'found', kind: kind.kind, label: kind.label, count: kind.count }
    : { status: 'none', kind: kind.kind, label: kind.label }
}

/**
 * 영역 전체의 모양.
 * - list: 해당 공시가 한 건 이상
 * - empty: 모든 종류를 확인했고 해당 공시가 없음(확인한 기간·종류와 '없어요')
 * - unchecked: 해당 공시가 없고 확인하지 못한 종류가 있음('없어요'라고 하지 않음)
 */
export type SignalsView =
  | { kind: 'list'; lines: SignalKindLine[]; items: SignalItemView[] }
  | { kind: 'empty'; lines: SignalKindLine[] }
  | { kind: 'unchecked'; lines: SignalKindLine[] }

export interface SignalItemView extends DisclosureSignalItem {
  label: string
}

export function signalsView(signals: DisclosureSignals): SignalsView {
  const lines = signals.kinds.map(kindLine)
  const labels = new Map(signals.kinds.map((k) => [k.kind, k.label]))
  if (signals.items.length > 0) {
    return {
      kind: 'list',
      lines,
      items: signals.items.map((item) => ({ ...item, label: labels.get(item.kind) ?? item.kind })),
    }
  }
  return lines.some((line) => line.status === 'unavailable') ? { kind: 'unchecked', lines } : { kind: 'empty', lines }
}

/** 확인하지 못한 종류의 이름 */
export function unavailableLabels(lines: SignalKindLine[]): string[] {
  return lines.filter((line) => line.status === 'unavailable').map((line) => line.label)
}
