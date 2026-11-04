package com.dartinsight.analysis.domain;

import com.dartinsight.common.error.ApiException;
import com.dartinsight.common.web.PageParams;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * 관리자 분석 작업 목록 조건(GET /api/admin/analyses). 값이 없으면 그 조건으로 거르지 않는다.
 * 검색어가 숫자만이면 분석 ID(8자리면 고유번호도), 그 밖에는 기업명(부분 일치)·추적 ID(일치)로 찾는다.
 *
 * @param status 상태. 없으면 null
 * @param days 1·7·30. 없으면 null(기간 제한 없음)
 * @param text 앞뒤 공백을 지운 검색어. 없거나 비었으면 null
 */
public record AdminAnalysisQuery(AnalysisStatus status, Integer days, String text, PageParams page) {
    private static final Set<Integer> ALLOWED_DAYS = Set.of(1, 7, 30);
    private static final int MAX_TEXT = 50;
    private static final Pattern DIGITS = Pattern.compile("\\d+");
    private static final Pattern CORP_CODE = Pattern.compile("\\d{8}");
    /** 분석 ID로 볼 수 있는 가장 긴 숫자(Long 범위 안) */
    private static final int MAX_ID_DIGITS = 18;

    public static AdminAnalysisQuery of(String status, Integer days, String q, Integer page, Integer size) {
        if (days != null && !ALLOWED_DAYS.contains(days)) {
            throw ApiException.invalidInput("days", "1, 7, 30 중 하나여야 합니다.");
        }
        return new AdminAnalysisQuery(status(status), days, text(q), PageParams.of(page, size));
    }

    /** 기간 시작(한국 시간 오늘부터 거꾸로 days일의 첫날 00:00). 기간 제한이 없으면 null */
    public LocalDateTime createdFrom(LocalDate today) {
        return days == null ? null : today.minusDays(days - 1L).atStartOfDay();
    }

    /** 숫자만인 검색어의 분석 ID. 아니면 null */
    public Long analysisId() {
        return numeric() && text.length() <= MAX_ID_DIGITS ? Long.valueOf(text) : null;
    }

    /** 8자리 숫자 검색어(고유번호). 아니면 null */
    public String corpCode() {
        return text != null && CORP_CODE.matcher(text).matches() ? text : null;
    }

    /** 숫자만이 아닌 검색어의 기업명 LIKE 패턴('!' 이스케이프). 아니면 null */
    public String corpNamePattern() {
        if (text == null || numeric()) {
            return null;
        }
        return "%" + text.replace("!", "!!").replace("%", "!%").replace("_", "!_") + "%";
    }

    /** 숫자만이 아닌 검색어(추적 ID 일치). 아니면 null */
    public String traceId() {
        return text == null || numeric() ? null : text;
    }

    private boolean numeric() {
        return text != null && DIGITS.matcher(text).matches();
    }

    private static AnalysisStatus status(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        return Arrays.stream(AnalysisStatus.values())
                .filter(value -> value.name().equals(raw.strip()))
                .findFirst()
                .orElseThrow(() -> ApiException.invalidInput("status",
                        "PENDING, RUNNING, COMPLETED, FAILED 중 하나여야 합니다."));
    }

    private static String text(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        String stripped = raw.strip();
        if (stripped.length() > MAX_TEXT) {
            throw ApiException.invalidInput("q", "50자 이하여야 합니다.");
        }
        return stripped;
    }
}
