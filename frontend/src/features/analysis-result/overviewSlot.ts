import { createContext, type ReactNode } from 'react'

/**
 * 분석 결과의 '기업 개요' 탭(#589)에 그릴 내용. 기업 개요는 기업 화면(report-selection) 기능이라 이 기능이 직접 import하지 않고(DIR-4),
 * 화면을 조립하는 app/router.tsx가 넣어 준다. 넣어 주지 않으면(테스트 등) 탭 안이 비어 있다.
 */
export const ResultOverviewContext = createContext<((corpCode: string) => ReactNode) | null>(null)
