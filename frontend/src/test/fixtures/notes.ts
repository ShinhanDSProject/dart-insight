import type { NoteItem } from '@/shared/api/notes'

/** 판단 노트 항목 예시(docs/api-spec.md NoteItem) */
export function noteItem(overrides: Partial<NoteItem> = {}): NoteItem {
  return {
    itemId: 1,
    corpCode: '00126380',
    kind: 'FINANCIAL_CHANGE',
    label: '손익계산서 · 매출액',
    text: '이전 1,000원 → 현재 1,200원, 증감 +200원(+20.0%)',
    changeType: null,
    memo: null,
    source: {
      analysisId: 42,
      analysisVersion: 'm2-13',
      changeId: 901,
      sjDiv: 'IS',
      rceptNo: '20261114001234',
      sectionNo: null,
      blockNo: null,
      dartUrl: 'https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20261114001234',
    },
    outdated: false,
    createdAt: '2026-10-27T10:15:00',
    updatedAt: '2026-10-27T10:15:00',
    ...overrides,
  }
}
