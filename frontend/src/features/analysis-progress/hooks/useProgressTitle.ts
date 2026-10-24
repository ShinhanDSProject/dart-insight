import type { Analysis } from '@/shared/api/analyses'
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle'
import { pageTitle } from '@/shared/lib/pageTitle'
import { progressTitle } from '../model/notification'

/** 진행 화면의 기본 제목. 분석을 불러오기 전에는 이것만 보인다 */
const PROGRESS_BASE_TITLE = pageTitle(['분석 진행'])

/**
 * 진행 화면에 있는 동안 탭 제목에 분석 상태를 보인다(4.3). 공통 제목 훅(useDocumentTitle) 위에 상태만 덧붙이므로,
 * 화면을 떠나면 다음 화면이 제 제목을 쓴다(결과 화면으로 넘어가도 진행 제목이 되살아나지 않는다).
 */
export function useProgressTitle(analysis: Analysis | null) {
  useDocumentTitle(progressTitle(analysis, PROGRESS_BASE_TITLE))
}
