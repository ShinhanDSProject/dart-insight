import { createBrowserRouter } from 'react-router'
import { Layout } from './Layout'
import { RouteError } from './RouteError'
import { AnalysisProgressPage } from '@/features/analysis-progress/AnalysisProgressPage'
import { AnalysisResultPage } from '@/features/analysis-result/AnalysisResultPage'
import { CompanyPage } from '@/features/report-selection/CompanyPage'
import { ComparabilityPage } from '@/features/comparability/ComparabilityPage'
import { SignupPage } from '@/features/user-registration/SignupPage'
import { LoginPage } from '@/features/user-login/LoginPage'
import { NotFoundPage } from './NotFoundPage'
import { SearchPage } from '@/features/company-search/SearchPage'

/**
 * 화면 경로(와이어프레임 번호)
 * - /                               W-01 ① 기업 검색
 * - /companies/:corpCode            W-01 ② 보고서 선택
 * - /companies/:corpCode/compare    W-01 ③ 비교 검증(?current=&previous=&basis=)
 * - /analyses/:analysisId/progress  W-02 분석 진행
 * - /analyses/:analysisId           W-03 분석 결과
 * handle.crumb는 상단 헤더의 경로 표시에 쓴다.
 */
export const router = createBrowserRouter([
  {
    element: <Layout />,
    errorElement: <RouteError />,
    children: [
      {
        // 화면 안에서 난 오류도 왼쪽 메뉴·상단 헤더 안에 보여 준다
        errorElement: <RouteError />,
        children: [
          { path: '/', element: <SearchPage />, handle: { crumb: '기업 검색' } },
          { path: '/signup', element: <SignupPage />, handle: { crumb: '회원가입' } },
          { path: '/login', element: <LoginPage />, handle: { crumb: '로그인' } },
          { path: '/companies/:corpCode', element: <CompanyPage />, handle: { crumb: '보고서 선택' } },
          { path: '/companies/:corpCode/compare', element: <ComparabilityPage />, handle: { crumb: '비교 조건 확인' } },
          { path: '/analyses/:analysisId/progress', element: <AnalysisProgressPage />, handle: { crumb: '분석 진행' } },
          { path: '/analyses/:analysisId', element: <AnalysisResultPage />, handle: { crumb: '분석 결과' } },
          { path: '*', element: <NotFoundPage />, handle: { crumb: '페이지 없음' } },
        ],
      },
    ],
  },
])
