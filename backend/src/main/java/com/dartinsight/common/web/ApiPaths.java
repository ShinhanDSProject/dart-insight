package com.dartinsight.common.web;

/**
 * 외부에 여는 backend API 경로(docs/api-spec.md 1장). 컨트롤러와 웹 설정의 경로 문자열은 여기에만 둔다.
 * 화면의 endpoints.ts와 짝이 맞아야 하므로, 경로를 바꾸면 두 곳을 같은 PR에서 고친다.
 */
public final class ApiPaths {

    public static final String BASE = "/api";
    public static final String CORS_PATTERN = BASE + "/**";

    public static final String COMPANIES = BASE + "/companies";
    public static final String BY_CORP_CODE = "/{corpCode}";
    public static final String COMPANY_REPORTS = "/companies/{corpCode}/reports";
    public static final String COMPANY_REPORT_PAIRS = COMPANIES + "/{corpCode}/report-pairs";
    public static final String REPORT_BY_RCEPT_NO = "/reports/{rceptNo}";

    public static final String COMPARABILITY_CHECKS = BASE + "/comparability-checks";

    public static final String ANALYSES = BASE + "/analyses";
    public static final String BY_ANALYSIS_ID = "/{analysisId}";
    public static final String ANALYSIS_SUMMARY = ANALYSES + "/{analysisId}/summary";
    public static final String ANALYSIS_FINANCIAL_CHANGES = ANALYSES + "/{analysisId}/financial-changes";
    public static final String ANALYSIS_TEXT_CHANGES = ANALYSES + "/{analysisId}/text-changes";
    public static final String BY_CHANGE_ID = "/{changeId}";
    public static final String ANALYSIS_DOCUMENT = ANALYSES + "/{analysisId}/documents/{side}";
    public static final String DOCUMENT_SECTION = "/sections/{sectionNo}";

    public static final String SYSTEM = BASE + "/system";
    public static final String HEALTH = "/health";

    private ApiPaths() {
    }
}
