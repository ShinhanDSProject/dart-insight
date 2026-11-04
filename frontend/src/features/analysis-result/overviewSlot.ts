import { createContext, type ReactNode } from 'react'

/**
 * 분석 결과의 '기업 개요' 탭(#589)에 그릴 내용. 기업 개요는 기업 화면(report-selection) 기능이라 이 기능이 직접 import하지 않고(DIR-4),
 * 화면을 조립하는 app/router.tsx가 넣어 준다. 넣어 주지 않으면(테스트 등) 탭 안이 비어 있다.
 */
export const ResultOverviewContext = createContext<((corpCode: string) => ReactNode) | null>(null)

/**
 * 분석 결과의 '보고서 선택' 탭(#659)에 그릴 기업 화면의 보고서 비교. 기업 개요와 같이 app/router.tsx가 넣어 준다(DIR-4).
 * 고른 보고서·비교 기준은 주소(?current=&basis=&previous=)에 있다.
 */
export const ResultReportsContext = createContext<((corpCode: string) => ReactNode) | null>(null)
