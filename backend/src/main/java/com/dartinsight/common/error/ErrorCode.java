package com.dartinsight.common.error;

/**
 * API 에러 코드. 이름은 {@code 영역_내용}, 목록은 docs/api-spec.md 4절과 같게 둔다.
 */
public enum ErrorCode {

    COMMON_INVALID_INPUT(400, "입력값을 확인해 주세요."),
    COMMON_EMAIL_ALREADY_EXISTS(409, "이미 가입된 이메일입니다."),
    AUTH_INVALID_CREDENTIALS(401, "이메일 또는 비밀번호를 확인해 주세요."),
    AUTH_INVALID_REFRESH_TOKEN(401, "로그인 정보가 만료되었습니다. 다시 로그인해 주세요."),
    AUTH_UNAUTHORIZED(401, "로그인이 필요합니다."),
    AUTH_FORBIDDEN(403, "관리자만 쓸 수 있습니다."),
    COMMON_NOT_FOUND(404, "요청한 주소를 찾을 수 없습니다."),
    COMMON_METHOD_NOT_ALLOWED(405, "지원하지 않는 요청 방식입니다."),
    COMMON_INTERNAL_ERROR(500, "서버에서 오류가 발생했습니다."),

    COMPANY_NOT_FOUND(404, "기업을 찾을 수 없습니다."),
    COMPANY_LIST_NOT_LOADED(503, "기업 목록을 아직 받지 않았습니다. 관리자에게 기업 목록 갱신을 요청해 주세요."),
    COMPANY_NOTE_NOT_FOUND(404, "노트 항목을 찾을 수 없습니다. 노트 목록을 다시 불러와 주세요."),
    COMPANY_DISCLOSURE_NOT_FOUND(404, "이 기업의 최근 공시에서 찾을 수 없거나 핵심 수치를 지원하지 않는 공시입니다. 최근 공시를 다시 불러와 주세요."),

    REPORT_NOT_FOUND(404, "보고서를 찾을 수 없습니다. 보고서 목록을 다시 불러와 주세요."),
    REPORT_SECTION_NOT_FOUND(404, "원문에서 이 항목을 찾을 수 없습니다. 목차에서 다시 골라 주세요."),

    ANALYSIS_NOT_FOUND(404, "분석을 찾을 수 없습니다."),
    ANALYSIS_NOT_COMPARABLE(422, "두 보고서를 비교할 수 없습니다."),
    ANALYSIS_NOT_READY(409, "분석이 아직 끝나지 않았습니다."),
    ANALYSIS_CHANGE_NOT_FOUND(404, "계정 항목을 찾을 수 없습니다."),
    ANALYSIS_TEXT_CHANGE_NOT_FOUND(404, "문장 변경 항목을 찾을 수 없습니다."),
    ANALYSIS_QUESTION_NOT_FOUND(404, "질문을 찾을 수 없습니다. 질문 기록을 다시 불러와 주세요."),
    ANALYSIS_NOTIFICATION_NOT_FOUND(404, "알림을 찾을 수 없습니다. 알림 목록을 다시 불러와 주세요."),

    DART_REQUEST_FAILED(502, "OpenDART에서 자료를 받지 못했습니다. 잠시 뒤 다시 시도해 주세요."),
    DART_RATE_LIMITED(503, "OpenDART 호출 한도를 넘었습니다. 저장된 자료만 볼 수 있습니다."),
    DART_KEY_MISSING(503, "서버에 OpenDART 인증키가 설정되지 않았습니다."),

    AI_SERVER_UNAVAILABLE(503, "AI 서버가 응답하지 않습니다. 잠시 뒤 다시 시도해 주세요."),

    COMMUNITY_FORBIDDEN(403, "내 글·댓글만 고치거나 지울 수 있습니다."),
    COMMUNITY_POST_NOT_FOUND(404, "글을 찾을 수 없습니다. 글 목록을 다시 불러와 주세요."),
    COMMUNITY_COMMENT_NOT_FOUND(404, "댓글을 찾을 수 없습니다. 글을 다시 불러와 주세요."),
    COMMUNITY_NICKNAME_REQUIRED(409, "글을 쓰려면 먼저 닉네임을 정해 주세요."),
    COMMUNITY_NICKNAME_TAKEN(409, "다른 사람이 쓰는 닉네임입니다."),
    COMMUNITY_TARGET_UNAVAILABLE(409, "가려지거나 지운 글·댓글입니다. 글을 다시 불러와 주세요.");

    private final int status;
    private final String defaultMessage;

    ErrorCode(int status, String defaultMessage) {
        this.status = status;
        this.defaultMessage = defaultMessage;
    }

    public int status() {
        return status;
    }

    public String defaultMessage() {
        return defaultMessage;
    }
}
