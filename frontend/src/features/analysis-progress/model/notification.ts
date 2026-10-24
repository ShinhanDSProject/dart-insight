import { match } from 'ts-pattern'
import type { Analysis } from '@/shared/api/analyses'

/**
 * 브라우저 알림 권한(4.3). 'unsupported'는 Notification API가 없는 브라우저.
 * 권한은 '끝나면 알림 받기'를 누를 때만 묻는다.
 */
export type NotificationPermissionState = 'unsupported' | 'default' | 'granted' | 'denied'

/** Notification API에서 쓰는 부분만. 테스트에서 가짜로 바꿔 넣는다 */
export interface NotificationApi {
  permission: string
}

/** 이 브라우저의 Notification. 없으면(미지원·서버 렌더) undefined */
export function browserNotification(): NotificationApi | undefined {
  return typeof globalThis.Notification === 'function' ? globalThis.Notification : undefined
}

/** 브라우저가 모르는 권한 값을 주면 아직 묻지 않은 것으로 본다 */
export function permissionState(api: NotificationApi | undefined): NotificationPermissionState {
  if (api === undefined) return 'unsupported'
  return match<string, NotificationPermissionState>(api.permission)
    .with('granted', () => 'granted')
    .with('denied', () => 'denied')
    .otherwise(() => 'default')
}

/** 끝난 단계 수로 본 진행률(0~100). 단계 정보가 없으면 null */
export function progressPercent(steps: Analysis['steps']): number | null {
  if (steps.length === 0) return null
  const done = steps.filter((step) => step.state === 'DONE').length
  return Math.round((done / steps.length) * 100)
}

/** 진행 화면의 탭 제목. 분석을 아직 못 불러왔으면 원래 제목 그대로 */
export function progressTitle(analysis: Pick<Analysis, 'status' | 'steps'> | null, baseTitle: string): string {
  if (analysis === null) return baseTitle
  return match(analysis.status)
    .with('PENDING', 'RUNNING', () => {
      const percent = progressPercent(analysis.steps)
      return percent === null ? `(진행 중) ${baseTitle}` : `(진행 중 ${percent}%) ${baseTitle}`
    })
    .with('COMPLETED', () => `✓ 분석 완료 · ${baseTitle}`)
    .with('FAILED', () => `분석 실패 · ${baseTitle}`)
    .exhaustive()
}

export type NotificationTarget = 'result' | 'progress'

export type NotificationDecision =
  | { type: 'skip'; reason: 'not-finished' | 'not-granted' | 'visible' | 'already-notified' }
  | { type: 'notify'; title: string; body: string; target: NotificationTarget }

export interface NotificationInput {
  analysis: Pick<Analysis, 'analysisId' | 'status' | 'corpName'>
  permission: NotificationPermissionState
  visibility: DocumentVisibilityState
  /** 이 화면에서 이미 알린 분석 ID */
  notifiedIds: ReadonlySet<number>
}

/**
 * 분석이 끝난 순간 알림을 띄울지 정한다. 권한이 있고 탭이 숨겨져 있을 때만,
 * 같은 분석은 한 번만 알린다. 탭을 보고 있으면 화면이 바로 바뀌므로 알리지 않는다.
 */
export function decideNotification({ analysis, permission, visibility, notifiedIds }: NotificationInput): NotificationDecision {
  const finished = match(analysis.status)
    .with('COMPLETED', () => ({ title: '분석이 끝났어요', target: 'result' as const }))
    .with('FAILED', () => ({ title: '분석하지 못했어요', target: 'progress' as const }))
    .with('PENDING', 'RUNNING', () => null)
    .exhaustive()
  if (finished === null) return { type: 'skip', reason: 'not-finished' }
  if (permission !== 'granted') return { type: 'skip', reason: 'not-granted' }
  if (visibility !== 'hidden') return { type: 'skip', reason: 'visible' }
  if (notifiedIds.has(analysis.analysisId)) return { type: 'skip', reason: 'already-notified' }
  const body =
    finished.target === 'result'
      ? `${analysis.corpName} 보고서 비교 결과를 볼 수 있어요.`
      : `${analysis.corpName} 보고서를 비교하지 못했어요. 눌러서 사유를 확인해 주세요.`
  return { type: 'notify', title: finished.title, body, target: finished.target }
}
