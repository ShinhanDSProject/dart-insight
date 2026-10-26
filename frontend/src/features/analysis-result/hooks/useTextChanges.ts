import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import {
  getTextChange,
  getTextChangeHistory,
  getTextChanges,
  type TextChangeCounts,
  type TextSectionCount,
  type TextSort,
} from '@/shared/api/textChanges'
import { useAsync } from '@/shared/hooks/useAsync'
import { apiTypesOf, nextContentAvailable, resolveTypeFilter, type TextTypeFilter } from '../model/textFilter'
import { textListReducer } from '../model/textList'

export const TEXT_PAGE_SIZE = 20

export interface TextListFilter {
  /** 주소의 유형 거르기. '내용 변경'이 없는 분석에서 CONTENT는 전체로 본다(#304) */
  type: TextTypeFilter | null
  sort: TextSort
  /** 최상위 섹션 제목(3.7) */
  section: string | null
  /** 2자 이상 검색어(3.7) */
  q: string | null
}

/**
 * 문장 변화 목록(3.9)과 '더 보기'. 거르기·정렬·섹션·검색어가 바뀌거나 언마운트하면 진행 중인 요청을 취소한다(ST-5).
 * type은 실제로 쓴 유형 거르기, contentAvailable은 '내용 변경' 칩을 보일지다(#304).
 * counts·sections는 마지막으로 받은 건수로, 다시 불러오는 동안에도 거르기 단추·섹션 선택의 건수를 그대로 둔다.
 */
export function useTextChanges(analysisId: number, { type: requestedType, sort, section, q }: TextListFilter) {
  const [state, dispatch] = useReducer(textListReducer, { status: 'loading' })
  // 숫자만 바뀜·위치 이동이 있는 분석인지(#304). 첫 응답 전에는 모른다(null)
  const [contentAvailable, setContentAvailable] = useState<boolean | null>(null)
  const type = resolveTypeFilter(requestedType, contentAvailable)
  const [attempt, setAttempt] = useState(0)
  const moreRequest = useRef<AbortController | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    const more = moreRequest
    dispatch({ type: 'load-start' })
    getTextChanges(analysisId, { types: apiTypesOf(type), sort, section, q, page: 0, size: TEXT_PAGE_SIZE }, controller.signal).then(
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
  }, [analysisId, type, sort, section, q, attempt])

  const [counts, setCounts] = useState<TextChangeCounts | null>(null)
  const [sections, setSections] = useState<TextSectionCount[] | null>(null)
  if (state.status === 'success' && state.data.counts !== counts) {
    setCounts(state.data.counts)
    setSections(state.data.sections)
    setContentAvailable(nextContentAvailable(contentAvailable, state.data.counts))
  }

  function loadMore() {
    if (state.status !== 'success' || state.more.status === 'loading') return
    const controller = new AbortController()
    moreRequest.current = controller
    dispatch({ type: 'more-start' })
    const query = { types: apiTypesOf(type), sort, section, q, page: state.data.page + 1, size: TEXT_PAGE_SIZE }
    getTextChanges(analysisId, query, controller.signal).then(
      (data) => {
        if (!controller.signal.aborted) dispatch({ type: 'more-success', data })
      },
      (error: unknown) => {
        if (!controller.signal.aborted) dispatch({ type: 'more-failure', error })
      },
    )
  }

  const reload = useCallback(() => setAttempt((n) => n + 1), [])
  return { state, counts, sections, contentAvailable, type, reload, loadMore }
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
