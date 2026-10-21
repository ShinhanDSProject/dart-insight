import { createBrowserRouter } from 'react-router'
import { Layout } from './components/Layout'
import { RouteError } from './components/RouteError'
import { AnalysisProgressPage } from './pages/AnalysisProgressPage'
import { AnalysisResultPage } from './pages/AnalysisResultPage'
import { CompanyPage } from './pages/CompanyPage'
import { ComparabilityPage } from './pages/ComparabilityPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { SearchPage } from './pages/SearchPage'

/**
 * 화면 경로(와이어프레임 번호)
 * - /                               W-01 ① 기업 검색
 * - /companies/:corpCode            W-01 ② 보고서 선택
 * - /companies/:corpCode/compare    W-01 ③ 비교 검증(?current=&previous=&basis=)
 * - /analyses/:analysisId/progress  W-02 분석 진행
 * - /analyses/:analysisId           W-03 분석 결과
 */
export const router = createBrowserRouter([
  {
    element: <Layout />,
    errorElement: <RouteError />,
    children: [
      { path: '/', element: <SearchPage /> },
      { path: '/companies/:corpCode', element: <CompanyPage /> },
      { path: '/companies/:corpCode/compare', element: <ComparabilityPage /> },
      { path: '/analyses/:analysisId/progress', element: <AnalysisProgressPage /> },
      { path: '/analyses/:analysisId', element: <AnalysisResultPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
