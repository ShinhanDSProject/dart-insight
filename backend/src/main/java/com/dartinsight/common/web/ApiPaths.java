package com.dartinsight.common.web;

/**
 * 외부에 여는 backend API 경로(docs/api-spec.md 1장). 컨트롤러와 웹 설정의 경로 문자열은 여기에만 둔다.
 * 화면의 endpoints.ts와 짝이 맞아야 하므로, 경로를 바꾸면 두 곳을 같은 PR에서 고친다.
 */
public final class ApiPaths {

    public static final String BASE = "/api";
    public static final String CORS_PATTERN = BASE + "/**";

    public static final String USERS = BASE + "/users";
    public static final String SESSIONS = BASE + "/sessions";
    public static final String CURRENT = "/current";
    public static final String CURRENT_SESSION = SESSIONS + CURRENT;
    public static final String SESSION_REFRESHES = BASE + "/session-refreshes";
    public static final String SOCIAL_SESSIONS = BASE + "/social-sessions";
    /** SOCIAL_SESSIONS 아래. 제공자 로그인 성공·실패 뒤 화면으로 돌려보낸다 */
    public static final String CALLBACK = "/callback";
    public static final String FAILURE = "/failure";
    public static final String SOCIAL_SESSION_CALLBACK = SOCIAL_SESSIONS + CALLBACK;
    public static final String SOCIAL_SESSION_FAILURE = SOCIAL_SESSIONS + FAILURE;
    // Spring Security OAuth2 Client 기본 경로(로그인 시작·제공자 콜백)
    public static final String OAUTH2_AUTHORIZATION = "/oauth2/authorization/**";
    public static final String OAUTH2_CALLBACK = "/login/oauth2/code/**";
    public static final String FAVORITE_COMPANIES = BASE + "/favorite-companies";
    public static final String NOTIFICATIONS = BASE + "/notifications";
    public static final String NOTIFICATION_READ = "/{notificationId}/read";
    public static final String FEATURED_COMPANIES = BASE + "/featured-companies";
    public static final String SEASON_CHANGES = BASE + "/season-changes";
    /** 내 판단 노트(6.5, FS-57) */
    public static final String NOTES = BASE + "/notes";
    public static final String BY_NOTE_ITEM_ID = "/{itemId}";
    public static final String NOTE_MEMO = BY_NOTE_ITEM_ID + "/memo";
    public static final String NOTE_EXPORT = "/export";
    public static final String COMPANIES = BASE + "/companies";
    public static final String BY_CORP_CODE = "/{corpCode}";
    /** COMPANIES 아래. 기업 개황(FS-45) */
    public static final String COMPANY_OVERVIEW = BY_CORP_CODE + "/overview";
    public static final String COMPANY_REPORTS = "/companies/{corpCode}/reports";
    public static final String COMPANY_REPORT_PAIRS = COMPANIES + "/{corpCode}/report-pairs";
    public static final String COMPANY_ANALYSES = COMPANIES + "/{corpCode}/analyses";
    public static final String COMPANY_FINANCIAL_TRENDS = COMPANIES + "/{corpCode}/financial-trends";
    public static final String COMPANY_KEY_FACTS = COMPANIES + "/{corpCode}/key-facts";
    public static final String COMPANY_DISCLOSURES = COMPANIES + "/{corpCode}/disclosures";
    /** COMPANY_DISCLOSURES 아래. 주요사항보고서 핵심 수치(FS-51) */
    public static final String DISCLOSURE_KEY_ITEMS = "/{rceptNo}/key-items";
    /** 확인해 볼 공시(FS-55) */
    public static final String COMPANY_DISCLOSURE_SIGNALS = COMPANIES + "/{corpCode}/disclosure-signals";
    public static final String COMPANY_BRIEFING =COMPANIES + "/{corpCode}/briefing";
    /** 사업보고서에 근거해 묻기(FS-53) */
    public static final String COMPANY_QUESTIONS = COMPANIES + "/{corpCode}/questions";
    public static final String REPORT_BY_RCEPT_NO = "/reports/{rceptNo}";

    public static final String COMPARABILITY_CHECKS = BASE + "/comparability-checks";

    public static final String ANALYSES = BASE + "/analyses";
    public static final String BY_ANALYSIS_ID = "/{analysisId}";
    public static final String ANALYSIS_SUMMARY = ANALYSES + "/{analysisId}/summary";
    public static final String ANALYSIS_FINANCIAL_CHANGES = ANALYSES + "/{analysisId}/financial-changes";
    public static final String ANALYSIS_TEXT_CHANGES = ANALYSES + "/{analysisId}/text-changes";
    public static final String BY_CHANGE_ID = "/{changeId}";
    public static final String CHANGE_HISTORY = BY_CHANGE_ID + "/history";
    public static final String TEXT_CHANGE_EXPLANATIONS = ANALYSIS_TEXT_CHANGES + "/{changeId}/explanations";
    /** 문장 변경의 관련 수시공시(3.6, #343) */
    public static final String TEXT_CHANGE_RELATED_DISCLOSURES = ANALYSIS_TEXT_CHANGES + "/{changeId}/related-disclosures";
    public static final String ANALYSIS_QUESTIONS = ANALYSES + "/{analysisId}/questions";
    public static final String QUESTION_FEEDBACK = "/{questionId}/feedback";
    public static final String ANALYSIS_DOCUMENT= ANALYSES + "/{analysisId}/documents/{side}";
    public static final String DOCUMENT_SECTION = "/sections/{sectionNo}";

    public static final String SYSTEM = BASE + "/system";
    public static final String HEALTH = "/health";
    public static final String AI_USAGE = "/ai-usage";

    private ApiPaths() {
    }
}
