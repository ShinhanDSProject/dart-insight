package com.dartinsight.support;

import com.dartinsight.company.service.CompanyImportService;
import com.dartinsight.dart.domain.CorpCodeEntry;
import com.dartinsight.report.domain.Correction;
import com.dartinsight.report.domain.Report;
import com.dartinsight.report.domain.ReportNameParser.ParsedReportName;
import com.dartinsight.report.domain.ReportType;
import com.dartinsight.report.repository.ReportRepository;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import org.springframework.jdbc.core.JdbcTemplate;

/** 관리자 API(3.34) 테스트가 표에 직접 넣는 행. 분석·회원·소셜 계정·관심 기업·글·LLM 호출을 원하는 시각·상태로 만든다. */
public final class AdminFixtures {
    public static final String CORP_A = "00000001";
    public static final String CORP_B = "00000002";
    public static final String CUR = "20260814000001";
    public static final String PREV = "20250814000001";

    private AdminFixtures() {
    }

    /** 기업 두 곳(예시전자·둘째화학)과 CORP_A의 반기보고서 두 개 */
    public static void companiesAndReports(CompanyImportService companies, ReportRepository reports,
            LocalDateTime now) {
        companies.save(List.of(
                new CorpCodeEntry(CORP_A, "예시전자", null, "900001", LocalDate.of(2026, 1, 1)),
                new CorpCodeEntry(CORP_B, "둘째화학", null, "900002", LocalDate.of(2026, 1, 1))));
        for (int year : new int[] {2025, 2026}) {
            reports.save(Report.create(year == 2026 ? CUR : PREV, CORP_A, "반기보고서 (" + year + ".06)",
                    new ParsedReportName(ReportType.HALF, year, LocalDate.of(year, 6, 30), Correction.ORIGINAL),
                    LocalDate.of(year, 8, 14), null, "예시전자", now));
        }
    }

    /**
     * 분석 한 줄. 보고서는 CUR·PREV를 쓴다(외래 키).
     *
     * @param startedAt 시작 전이면 null
     * @param endedAt 완료·실패 시각(updated_at·completed_at). 끝나지 않았으면 null(updated_at은 시작·요청 시각)
     */
    public static long analysis(JdbcTemplate jdbc, String corpCode, String status, String step, String version,
            String errorCode, String traceId, LocalDateTime createdAt, LocalDateTime startedAt,
            LocalDateTime endedAt) {
        LocalDateTime updatedAt = endedAt != null ? endedAt : startedAt != null ? startedAt : createdAt;
        jdbc.update("INSERT INTO analysis (corp_code, current_rcept_no, previous_rcept_no, basis, analysis_version, "
                + "status, step, error_code, error_message, request_trace_id, created_at, updated_at, started_at, "
                + "completed_at, version) VALUES (?, ?, ?, 'YOY', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)",
                corpCode, CUR, PREV, version, status, step, errorCode,
                errorCode == null ? null : "요약을 만들지 못했어요.", traceId, ts(createdAt), ts(updatedAt),
                ts(startedAt), ts(endedAt));
        return jdbc.queryForObject("SELECT MAX(id) FROM analysis", Long.class);
    }

    /** 일반 가입 없이 소셜 계정만 있는 회원 */
    public static long socialUser(JdbcTemplate jdbc, String provider, String email, LocalDateTime createdAt) {
        jdbc.update("INSERT INTO app_user (created_at, updated_at) VALUES (?, ?)", ts(createdAt), ts(createdAt));
        long userId = jdbc.queryForObject("SELECT MAX(id) FROM app_user", Long.class);
        socialAccount(jdbc, userId, provider, email, createdAt);
        return userId;
    }

    public static void socialAccount(JdbcTemplate jdbc, long userId, String provider, String email,
            LocalDateTime connectedAt) {
        jdbc.update("INSERT INTO social_account (user_id, provider, provider_user_id, email, email_verified, "
                + "created_at, updated_at) VALUES (?, ?, ?, ?, FALSE, ?, ?)", userId, provider,
                provider + "-" + userId + "-" + connectedAt.getNano(), email, ts(connectedAt), ts(connectedAt));
    }

    public static void setCreatedAt(JdbcTemplate jdbc, long userId, LocalDateTime createdAt) {
        jdbc.update("UPDATE app_user SET created_at = ? WHERE id = ?", ts(createdAt), userId);
    }

    public static void favorite(JdbcTemplate jdbc, long userId, String corpCode, LocalDateTime createdAt) {
        jdbc.update("INSERT INTO favorite_company (user_id, corp_code, created_at) VALUES (?, ?, ?)", userId,
                corpCode, ts(createdAt));
    }

    public static void post(JdbcTemplate jdbc, long userId, String status, LocalDateTime createdAt) {
        jdbc.update("INSERT INTO community_post (corp_code, user_id, body, status, created_at) VALUES (?, ?, ?, ?, ?)",
                CORP_A, userId, "본문", status, ts(createdAt));
    }

    public static void llmCall(JdbcTemplate jdbc, long analysisId, String provider, String model, String outcome,
            LocalDateTime calledAt, Integer inputTokens, Integer outputTokens) {
        jdbc.update("INSERT INTO llm_call (analysis_id, task, provider, model, prompt_version, called_at, "
                + "input_tokens, output_tokens, latency_ms, attempt, outcome) "
                + "VALUES (?, 'summary', ?, ?, 'v1', ?, ?, ?, 100, 1, ?)", analysisId, provider, model,
                ts(calledAt), inputTokens, outputTokens, outcome);
    }

    public static void planInterest(JdbcTemplate jdbc, String plan, Long userId, LocalDateTime createdAt) {
        jdbc.update("INSERT INTO plan_interest (plan, source, user_id, created_at) VALUES (?, 'pricing', ?, ?)",
                plan, userId, ts(createdAt));
    }

    private static Timestamp ts(LocalDateTime time) {
        return time == null ? null : Timestamp.valueOf(time);
    }
}
