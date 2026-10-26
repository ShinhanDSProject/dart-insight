package com.dartinsight.support;

import java.util.List;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * 테스트 데이터 정리. CI에서는 테스트가 MariaDB 하나를 같이 쓰므로, 테스트마다 앞에서 지운다.
 * 테이블을 추가하면 아래 목록에 외래 키의 자식 테이블부터 넣는다.
 */
public final class TestData {

    private static final List<String> TABLES_CHILD_FIRST = List.of(
            "analysis_question",
            "text_change_explanation",
            "summary_item",
            "llm_call",
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
            "report",
            "company_overview",
            "company");

    private TestData() {
    }

    public static void clearAll(JdbcTemplate jdbcTemplate) {
        for (String table : TABLES_CHILD_FIRST) {
            jdbcTemplate.update("DELETE FROM " + table);
        }
    }
}
