import { createBrowserRouter } from 'react-router'
import { Layout } from './components/Layout'
import { AnalysisProgressPage } from './pages/AnalysisProgressPage'
import { AnalysisResultPage } from './pages/AnalysisResultPage'
import { CompanyPage } from './pages/CompanyPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { SearchPage } from './pages/SearchPage'

/**
 * 화면 경로(와이어프레임 번호)
 * - /                               W-01 ① 기업 검색
 * - /companies/:corpCode            W-01 ②·③ 보고서 선택·비교 검증
 * - /analyses/:analysisId/progress  W-02 분석 진행
 * - /analyses/:analysisId           W-03 분석 결과
 */
export const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: '/', element: <SearchPage /> },
      { path: '/companies/:corpCode', element: <CompanyPage /> },
      { path: '/analyses/:analysisId/progress', element: <AnalysisProgressPage /> },
      { path: '/analyses/:analysisId', element: <AnalysisResultPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
