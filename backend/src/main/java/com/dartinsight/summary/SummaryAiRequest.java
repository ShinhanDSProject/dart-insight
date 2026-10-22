package com.dartinsight.summary;

import java.util.List;

/** AI 서버 요약 요청(POST /internal/summaries). 사용자 정보는 넣지 않는다. */
public record SummaryAiRequest(String companyName, String previousReport, String currentReport,
        List<TextItem> textItems, List<FinancialItem> financialItems) {

    public record Source(String evidenceId, String sectionPath, String text) {
    }

    public record TextItem(String ref, String changeType, String sectionPath, List<Source> sources) {
    }

    public record FinancialItem(String ref, String accountName, String direction, List<Source> candidates) {
    }
}
