import { useCallback, useEffect, useReducer, useState } from 'react'
import { getAdminReports, moderateReport, type ModerationRequest, type ReportQueue } from '@/shared/api/community'
import { useAuth } from '@/shared/auth/authContext'
import { reportsReducer, type ReportsState } from '../model/adminReports'

export interface AdminReportsController {
  /** 로그인 확인 중이면 loading */
  state: ReportsState
  reload: () => void
  /** 신고를 처리하고 목록의 그 항목을 서버 답으로 바꾼다. 실패하면 거부된 Promise */
  moderate: (reportId: number, request: ModerationRequest) => Promise<void>
}

/**
 * 관리자 신고 목록(FS-58, #463). 로그인하지 않았으면 서버를 부르지 않고 anonymous다.
 * 관리자인지는 서버가 정한다(아니면 403 AUTH_FORBIDDEN). 큐·쪽·회원이 바뀌면 이전 요청을 취소한다(ST-5).
 */
export function useAdminReports(queue: ReportQueue, page: number): AdminReportsController {
  const auth = useAuth()
  const userId = auth.state.status === 'authenticated' ? auth.state.userId : null
  const checking = auth.state.status === 'loading'
  const [state, dispatch] = useReducer(reportsReducer, { status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (checking) {
      dispatch({ type: 'start' })
      return
    }
    if (userId === null) {
      dispatch({ type: 'set-anonymous' })
      return
    }
    const controller = new AbortController()
    dispatch({ type: 'start' })
    getAdminReports(queue, page, { signal: controller.signal }).then(
      (data) => {
        if (!controller.signal.aborted) dispatch({ type: 'resolve', data })
      },
      (error: unknown) => {
        if (!controller.signal.aborted) dispatch({ type: 'reject', error })
      },
    )
    return () => controller.abort()
  }, [checking, userId, queue, page, attempt])

  const reload = useCallback(() => setAttempt((n) => n + 1), [])
  const moderate = useCallback(async (reportId: number, request: ModerationRequest) => {
    const item = await moderateReport(reportId, request)
    dispatch({ type: 'replace-item', item })
  }, [])

  return { state, reload, moderate }
}
