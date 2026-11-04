import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import {
  getTextChange,
  getTextChangeHistory,
  getTextChangeRelatedDisclosures,
  getTextChanges,
  type TextChangeCounts,
  type TextChangeQuery,
  type TextField,
  type TextListGroup,
  type TextListing,
  type TextSectionCount,
  type TextSort,
} from '@/shared/api/textChanges'
import { useAsync } from '@/shared/hooks/useAsync'
import { apiTypesOf, nextContentAvailable, resolveTypeFilter, type TextTypeFilter } from '../model/textFilter'
import { listGroupsOf } from '../model/textGroups'
import { textListReducer } from '../model/textList'

export const TEXT_PAGE_SIZE = 10

export interface TextListFilter {
  /** 주소의 유형 거르기. '내용 변경'이 없는 분석에서 CONTENT는 전체로 본다(#304) */
  type: TextTypeFilter | null
  sort: TextSort
  /** 최상위 섹션 제목(3.7) */
  section: string | null
  /** 2자 이상 검색어(3.7) */
  q: string | null
  /** 위험 관련 목차의 변경만(3.9) */
  risk: boolean
  /** 분야별 표에서 고른 분야(3.28) */
  field: TextField | null
}

/** 쪽을 나눠 받는 목록과 '더 보기'. query가 바뀌거나 언마운트하면 진행 중인 요청을 취소한다(ST-5). query는 조건이 바뀔 때만 새 값을 넘긴다 */
function usePagedTextChanges(analysisId: number, query: Omit<TextChangeQuery, 'page' | 'size'>) {
  const [state, dispatch] = useReducer(textListReducer, { status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const moreRequest = useRef<AbortController | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    const more = moreRequest
    dispatch({ type: 'load-start' })
    getTextChanges(analysisId, { ...query, page: 0, size: TEXT_PAGE_SIZE }, controller.signal).then(
      (data) => {
        if (!controller.signal.aborted) dispatch({ type: 'load-success', data })
      },
      (error: unknown) => {
        if (!controller.signal.aborted) dispatch({ type: 'load-failure', error })
      },
    )
    return () => {
      controller.abort()
      more.current?.abort()
    }
  }, [analysisId, query, attempt])

  function loadMore() {
    if (state.status !== 'success' || state.more.status === 'loading') return
    const controller = new AbortController()
    moreRequest.current = controller
    dispatch({ type: 'more-start' })
    getTextChanges(analysisId, { ...query, page: state.data.page + 1, size: TEXT_PAGE_SIZE }, controller.signal).then(
      (data) => {
        if (!controller.signal.aborted) dispatch({ type: 'more-success', data })
      },
      (error: unknown) => {
        if (!controller.signal.aborted) dispatch({ type: 'more-failure', error })
      },
    )
  }

  const reload = useCallback(() => setAttempt((n) => n + 1), [])
  return { state, reload, loadMore }
}

/**
 * 문장 변화 목록(3.9)과 '더 보기'. 거르지 않으면 기본 목록 묶음만 부르고, 거르면 접힌 변경도 찾는다(3.29).
 * type은 실제로 쓴 유형 거르기, contentAvailable은 '내용 변경' 칩을 보일지다(#304).
 * counts·sections·riskCounts·listing은 마지막으로 받은 건수로, 다시 불러오는 동안에도 거르기 단추·섹션 선택·위험 요인 카드·분야별 표의 건수를 그대로 둔다.
 * listing은 첫 응답 전이나 첫 조회가 실패하면 null이다(변경이 없다는 뜻이 아님).
 */
export function useTextChanges(analysisId: number, { type: requestedType, sort, section, q, risk, field }: TextListFilter) {
  // 숫자만 바뀜·위치 이동이 있는 분석인지(#304). 첫 응답 전에는 모른다(null)
  const [contentAvailable, setContentAvailable] = useState<boolean | null>(null)
  const type = resolveTypeFilter(requestedType, contentAvailable)
  const query = useMemo(
    () => ({ types: apiTypesOf(type), sort, section, q, risk, field, groups: listGroupsOf({ type, section, q, risk, field }) }),
    [type, sort, section, q, risk, field],
  )
  const { state, reload, loadMore } = usePagedTextChanges(analysisId, query)

  const [counts, setCounts] = useState<TextChangeCounts | null>(null)
  const [sections, setSections] = useState<TextSectionCount[] | null>(null)
  const [riskCounts, setRiskCounts] = useState<TextChangeCounts | null>(null)
  const [listing, setListing] = useState<TextListing | null>(null)
  if (state.status === 'success' && state.data.counts !== counts) {
    setCounts(state.data.counts)
    setSections(state.data.sections)
    setRiskCounts(state.data.riskCounts)
    setListing({ listVersion: state.data.listVersion, fieldCounts: state.data.fieldCounts, missingFields: state.data.missingFields, groupCounts: state.data.groupCounts })
    setContentAvailable(nextContentAvailable(contentAvailable, state.data.counts))
  }

  return { state, counts, sections, riskCounts, listing, contentAvailable, type, reload, loadMore }
}

/** 접힌 묶음 하나의 목록(3.29). 묶음을 펼칠 때 마운트해 처음 펼칠 때만 부른다 */
export function useTextChangeGroup(analysisId: number, group: TextListGroup, sort: TextSort) {
  const query = useMemo(() => ({ types: [], sort, section: null, q: null, groups: [group] }), [group, sort])
  return usePagedTextChanges(analysisId, query)
}

/** 문장·표 변경 하나의 원문 근거(3.4) */
export function useTextChangeDetail(analysisId: number, changeId: number) {
  const load = useCallback((signal: AbortSignal) => getTextChange(analysisId, changeId, signal), [analysisId, changeId])
  return useAsync(load)
}

/** 문장 변경 이력(3.8). 완료된 분석을 이어 붙인 여러 기간 */
export function useTextChangeHistory(analysisId: number, changeId: number) {
  const load = useCallback((signal: AbortSignal) => getTextChangeHistory(analysisId, changeId, signal), [analysisId, changeId])
  return useAsync(load)
}

/** 문장 변경의 관련 수시공시(3.6, FS-54). 처음 요청이면 서버가 계산하느라 수 초 걸릴 수 있다 */
export function useRelatedDisclosures(analysisId: number, changeId: number) {
  const load = useCallback(
    (signal: AbortSignal) => getTextChangeRelatedDisclosures(analysisId, changeId, signal),
    [analysisId, changeId],
  )
  return useAsync(load)
}
