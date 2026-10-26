import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { listDisclosures } from '@/shared/api/disclosures'
import { runWithConcurrency } from '@/shared/lib/concurrency'
import { browserStorage } from '@/shared/lib/recentAnalyses'
import {
  FEED_COMPANY_LIMIT,
  FEED_CONCURRENCY,
  FEED_DAYS,
  feedReducer,
  feedView,
  isFeedSeen,
  kstDate,
  loadFeedSeenAt,
  saveFeedSeenAt,
  type FeedCompany,
  type FeedView,
} from '../model/favoriteFeed'

interface Round {
  /** 이 회차를 만든 관심 기업 목록(고유번호·이름). 바뀌면 처음부터 다시 받는다 */
  key: string
  corpCodes: string[]
  reset: boolean
}

export interface FavoriteDisclosuresResult {
  view: FeedView
  /** 실패한 기업만 다시 부른다 */
  retryFailed: () => void
}

/**
 * 관심 기업들의 최근 30일 공시를 모아 '관심 기업 새 공시' 피드로 만든다(FS-52, #364).
 * 앞의 10곳까지만, 한 번에 3곳씩 부른다. 기업마다 성공·실패를 따로 두어 한 곳이 실패해도 나머지는 보인다.
 * 목록이 바뀌거나 언마운트하면 진행 중인 요청을 취소한다(ST-5).
 * '새 공시'는 처음 그릴 때 읽은 '마지막으로 본 날'로 정하고, 피드를 다 받은 뒤 오늘(한국 시간)로 바꾼다.
 */
export function useFavoriteDisclosures(companies: readonly FeedCompany[]): FavoriteDisclosuresResult {
  const targets = companies.slice(0, FEED_COMPANY_LIMIT)
  const key = targetsKey(targets)
  const [results, dispatch] = useReducer(feedReducer, {})
  const [round, setRound] = useState<Round>(() => fullRound(targets))
  // 관심 기업 목록이 바뀌면 처음부터 다시 받는다(렌더 중 상태 맞추기)
  if (round.key !== key) setRound(fullRound(targets))

  const [lastSeen] = useState(() => loadFeedSeenAt(browserStorage()))
  const saved = useRef(false)

  useEffect(() => {
    if (round.corpCodes.length === 0) return
    const controller = new AbortController()
    dispatch({ type: 'start', corpCodes: round.corpCodes, reset: round.reset })
    void runWithConcurrency(
      round.corpCodes,
      FEED_CONCURRENCY,
      (corpCode) =>
        listDisclosures(corpCode, controller.signal, FEED_DAYS).then(
          (list) => {
            if (!controller.signal.aborted) dispatch({ type: 'resolve', corpCode, items: list.items })
          },
          () => {
            if (!controller.signal.aborted) dispatch({ type: 'reject', corpCode })
          },
        ),
      controller.signal,
    )
    return () => controller.abort()
  }, [round])

  const view = feedView(targets, results, lastSeen)
  const seen = isFeedSeen(view)

  useEffect(() => {
    if (!seen || saved.current) return
    saved.current = true
    saveFeedSeenAt(browserStorage(), kstDate(new Date()))
  }, [seen])

  const retryFailed = useCallback(() => {
    const failed = Object.keys(results).filter((code) => results[code].status === 'error')
    if (failed.length > 0) setRound({ key: round.key, corpCodes: failed, reset: false })
  }, [round, results])

  return { view, retryFailed }
}

function targetsKey(targets: readonly FeedCompany[]): string {
  return targets.map((company) => `${company.corpCode}:${company.corpName}`).join('|')
}

function fullRound(targets: readonly FeedCompany[]): Round {
  return { key: targetsKey(targets), corpCodes: targets.map((company) => company.corpCode), reset: true }
}
