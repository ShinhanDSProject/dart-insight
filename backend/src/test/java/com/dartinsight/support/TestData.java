package com.dartinsight.support;

import java.util.List;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * 테스트 데이터 정리. CI에서는 테스트가 MariaDB 하나를 같이 쓰므로, 테스트마다 앞에서 지운다.
 * 테이블을 추가하면 아래 목록에 외래 키의 자식 테이블부터 넣는다.
 */
public final class TestData {

    private static final List<String> TABLES_CHILD_FIRST = List.of(
            "community_repost_request",
            "community_moderation",
            "community_report_entry",
            "community_report",
            "community_like",
            "community_quote",
            // 답글이 부모 댓글을 가리키므로(자기 참조 외래 키) 답글부터 지운다
            "community_comment WHERE parent_id IS NOT NULL",
            "community_comment",
            "community_post",
            "judgment_note_item",
            "notification",
            "season_change",
            "related_disclosure",
            "related_disclosure_run",
            "analysis_question",
            "text_change_explanation",
            "summary_item",
            "llm_call",
            "plan_followup",
            "company_briefing",
            "company_question",
            "company_outlook",
            "text_change",
            "financial_change",
            "analysis",
            "document_block",
            "document_section",
            "report_document",
            "financial_account",
            "financial_statement_fetch",
            "report_key_account",
            "report_key_account_fetch",
            "report_key_fact",
            "watched_report",
            "report",
            "company_overview",
            "disclosure_window_item",
            "disclosure_window_fetch",
            "disclosure_key_item",
            "disclosure_audit_opinion",
            "company_disclosure",
            "company_disclosure_fetch",
            "favorite_company",
            "featured_company",
            "company");

    private TestData() {
    }

    public static void clearAll(JdbcTemplate jdbcTemplate) {
        for (String table : TABLES_CHILD_FIRST) {
            jdbcTemplate.update("DELETE FROM " + table);
        }
    }
}
