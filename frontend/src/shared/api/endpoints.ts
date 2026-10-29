/**
 * 화면이 부르는 backend API 경로(docs/api-spec.md 1장). 경로 문자열은 여기에만 둔다.
 * 경로 변수는 seg()로 감싸 항상 인코딩한다. 쿼리 문자열은 client.ts의 apiGet이 붙인다.
 */

const seg = (value: string | number) => encodeURIComponent(String(value))

const analysis = (analysisId: string | number) => `/api/analyses/${seg(analysisId)}`

export const endpoints = {
  users: () => '/api/users',
  sessions: () => '/api/sessions',
  currentSession: () => '/api/sessions/current',
  sessionRefreshes: () => '/api/session-refreshes',
  socialLogin: (provider: string) => `/oauth2/authorization/${seg(provider)}`,
  favoriteCompanies: () => '/api/favorite-companies',
  favoriteCompany: (corpCode: string) => `/api/favorite-companies/${seg(corpCode)}`,
  notifications: () => '/api/notifications',
  notificationRead: (notificationId: number) => `/api/notifications/${seg(notificationId)}/read`,
  featuredCompanies: () => '/api/featured-companies',
  seasonChanges: () => '/api/season-changes',
  notes: () => '/api/notes',
  note: (itemId: number) => `/api/notes/${seg(itemId)}`,
  noteMemo: (itemId: number) => `/api/notes/${seg(itemId)}/memo`,
  notesExport: () => '/api/notes/export',
  companies: () => '/api/companies',
  company: (corpCode: string) => `/api/companies/${seg(corpCode)}`,
  companyOverview: (corpCode: string) => `/api/companies/${seg(corpCode)}/overview`,
  companyReports: (corpCode: string) => `/api/companies/${seg(corpCode)}/reports`,
  reportPairs: (corpCode: string) => `/api/companies/${seg(corpCode)}/report-pairs`,
  companyAnalyses: (corpCode: string) => `/api/companies/${seg(corpCode)}/analyses`,
  companyFinancialTrends: (corpCode: string) => `/api/companies/${seg(corpCode)}/financial-trends`,
  companyKeyFacts: (corpCode: string) => `/api/companies/${seg(corpCode)}/key-facts`,
  companyDisclosures: (corpCode: string) => `/api/companies/${seg(corpCode)}/disclosures`,
  disclosureKeyItems: (corpCode: string, rceptNo: string) =>
    `/api/companies/${seg(corpCode)}/disclosures/${seg(rceptNo)}/key-items`,
  companyDisclosureSignals: (corpCode: string) => `/api/companies/${seg(corpCode)}/disclosure-signals`,
  companyBriefing:(corpCode: string) => `/api/companies/${seg(corpCode)}/briefing`,
  companyOutlook: (corpCode: string) => `/api/companies/${seg(corpCode)}/outlook`,
  companyPlanFollowups: (corpCode: string) => `/api/companies/${seg(corpCode)}/plan-followups`,
  companyCheckpoints: (corpCode: string) => `/api/companies/${seg(corpCode)}/checkpoints`,
  companyQuestions: (corpCode: string) => `/api/companies/${seg(corpCode)}/questions`,
  report: (rceptNo: string) => `/api/reports/${seg(rceptNo)}`,
  comparabilityChecks: () => '/api/comparability-checks',
  analyses: () => '/api/analyses',
  analysis,
  summary: (analysisId: number) => `${analysis(analysisId)}/summary`,
  financialChanges: (analysisId: number) => `${analysis(analysisId)}/financial-changes`,
  financialChange: (analysisId: number, changeId: number) =>
    `${analysis(analysisId)}/financial-changes/${seg(changeId)}`,
  textChanges: (analysisId: number) => `${analysis(analysisId)}/text-changes`,
  textChange: (analysisId: number, changeId: number) => `${analysis(analysisId)}/text-changes/${seg(changeId)}`,
  textChangeExplanations: (analysisId: number, changeId: number) =>
    `${analysis(analysisId)}/text-changes/${seg(changeId)}/explanations`,
  textChangeHistory: (analysisId: number, changeId: number) =>
    `${analysis(analysisId)}/text-changes/${seg(changeId)}/history`,
  textChangeRelatedDisclosures: (analysisId: number, changeId: number) =>
    `${analysis(analysisId)}/text-changes/${seg(changeId)}/related-disclosures`,
  document: (analysisId: number, side: string) => `${analysis(analysisId)}/documents/${seg(side)}`,
  documentSection: (analysisId: number, side: string, sectionNo: number) =>
    `${analysis(analysisId)}/documents/${seg(side)}/sections/${seg(sectionNo)}`,
  questions: (analysisId: number) => `${analysis(analysisId)}/questions`,
  questionFeedback: (analysisId: number, questionId: number) =>
    `${analysis(analysisId)}/questions/${seg(questionId)}/feedback`,
  aiUsage: () => '/api/system/ai-usage',
  currentNickname: () => '/api/users/current/nickname',
  companyPosts: (corpCode: string) => `/api/companies/${seg(corpCode)}/posts`,
  post: (postId: number) => `/api/posts/${seg(postId)}`,
  postComments: (postId: number) => `/api/posts/${seg(postId)}/comments`,
  postLike: (postId: number) => `/api/posts/${seg(postId)}/like`,
  postReports: (postId: number) => `/api/posts/${seg(postId)}/reports`,
  comment: (commentId: number) => `/api/comments/${seg(commentId)}`,
  commentLike: (commentId: number) => `/api/comments/${seg(commentId)}/like`,
  commentReports: (commentId: number) => `/api/comments/${seg(commentId)}/reports`,
  repostRequests: (reportId: number) => `/api/reports/${seg(reportId)}/repost-requests`,
}
