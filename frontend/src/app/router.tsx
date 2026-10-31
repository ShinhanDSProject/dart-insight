import { createBrowserRouter } from 'react-router'
import { Layout } from './Layout'
import { RouteError } from './RouteError'
import { NotFoundPage } from './NotFoundPage'
import { PageSuspense } from './PageSuspense'
import { lazyPage } from './lazyPage'

// 화면 코드는 그 화면을 처음 열 때 받는다(첫 로딩을 줄이기 위해). 받지 못하면 RouteError가 '다시 시도'를 보여 준다.
const SearchPage = lazyPage(() => import('@/features/company-search/SearchPage').then((m) => m.SearchPage))
const ExplorePage = lazyPage(() => import('@/features/company-search/ExplorePage').then((m) => m.ExplorePage))
const SignupPage = lazyPage(() => import('@/features/user-registration/SignupPage').then((m) => m.SignupPage))
const LoginPage = lazyPage(() => import('@/features/user-login/LoginPage').then((m) => m.LoginPage))
const CompanyPage = lazyPage(() => import('@/features/report-selection/CompanyPage').then((m) => m.CompanyPage))
const ComparabilityPage = lazyPage(() =>
  import('@/features/comparability/ComparabilityPage').then((m) => m.ComparabilityPage),
)
const AnalysisProgressPage = lazyPage(() =>
  import('@/features/analysis-progress/AnalysisProgressPage').then((m) => m.AnalysisProgressPage),
)
const AnalysisResultPage = lazyPage(() =>
  import('@/features/analysis-result/AnalysisResultPage').then((m) => m.AnalysisResultPage),
)
const NotesPage = lazyPage(() => import('@/features/notes/NotesPage').then((m) => m.NotesPage))
const CompanyComparisonPage = lazyPage(() =>
  import('@/features/company-comparison/CompanyComparisonPage').then((m) => m.CompanyComparisonPage),
)
const AiUsagePage = lazyPage(() => import('@/features/ai-usage/AiUsagePage').then((m) => m.AiUsagePage))
const AdminReportsPage = lazyPage(() =>
  import('@/features/admin-reports/AdminReportsPage').then((m) => m.AdminReportsPage),
)

/**
 * 화면 경로(와이어프레임 번호)
 * - /                               W-01 ① 기업 검색
 * - /companies/:corpCode            W-01 ② 보고서 선택
 * - /companies/:corpCode/compare    W-01 ③ 비교 검증(?current=&previous=&basis=)
 * - /analyses/:analysisId/progress  W-02 분석 진행
 * - /analyses/:analysisId           W-03 분석 결과
 * - /notes                          내 판단 노트(FS-57, 로그인한 회원)
 * - /compare/companies              여러 기업 나란히 보기(FS-56, ?corps=고유번호,…&type=ANNUAL&fs=CFS)
 * - /system/ai-usage                AI 사용 현황(FS-15, ?days=7|30)
 * - /admin/reports                  신고 관리(FS-58, 관리자만, ?queue=all&page=)
 * handle.crumb는 화면 이름이다. 상단 바에는 보이지 않는다(#548, 화면 머리의 브레드크럼은 화면이 PageHeader로 그린다).
 */
export const router = createBrowserRouter([
  {
    element: <Layout />,
    errorElement: <RouteError />,
    children: [
      {
        // 화면 안에서 난 오류(화면 코드를 받지 못한 경우 포함)도 상단 바·하단 바 안에 보여 준다
        errorElement: <RouteError />,
        children: [
          { path: '/', element: <PageSuspense><SearchPage /></PageSuspense>, handle: { crumb: '기업 검색' } },
          { path: '/explore', element: <PageSuspense><ExplorePage /></PageSuspense>, handle: { crumb: '둘러보기' } },
          { path: '/signup', element: <PageSuspense><SignupPage /></PageSuspense>, handle: { crumb: '회원가입' } },
          { path: '/login', element: <PageSuspense><LoginPage /></PageSuspense>, handle: { crumb: '로그인' } },
          {
            path: '/companies/:corpCode',
            element: <PageSuspense><CompanyPage /></PageSuspense>,
            handle: { crumb: '보고서 선택' },
          },
          {
            path: '/companies/:corpCode/compare',
            element: <PageSuspense><ComparabilityPage /></PageSuspense>,
            handle: { crumb: '비교 조건 확인' },
          },
          {
            path: '/analyses/:analysisId/progress',
            element: <PageSuspense><AnalysisProgressPage /></PageSuspense>,
            handle: { crumb: '분석 진행' },
          },
          {
            path: '/analyses/:analysisId',
            element: <PageSuspense><AnalysisResultPage /></PageSuspense>,
            handle: { crumb: '분석 결과' },
          },
          {
            path: '/notes',
            element: <PageSuspense><NotesPage /></PageSuspense>,
            handle: { crumb: '내 판단 노트' },
          },
          {
            path: '/compare/companies',
            element: <PageSuspense><CompanyComparisonPage /></PageSuspense>,
            handle: { crumb: '기업 나란히 보기' },
          },
          {
            path: '/system/ai-usage',
            element: <PageSuspense><AiUsagePage /></PageSuspense>,
            handle: { crumb: 'AI 사용 현황' },
          },
          {
            path: '/admin/reports',
            element: <PageSuspense><AdminReportsPage /></PageSuspense>,
            handle: { crumb: '신고 관리' },
          },
          { path: '*', element: <NotFoundPage />, handle: { crumb: '페이지 없음' } },
        ],
      },
    ],
  },
])
