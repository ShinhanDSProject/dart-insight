package com.dartinsight.summary.dto;

import java.util.List;

/** AI 서버 요약 요청(POST /internal/summaries). 사용자 정보는 넣지 않는다. */
public record SummaryAiRequest(String companyName, String previousReport, String currentReport,
        List<TextItem> textItems, List<FinancialItem> financialItems) {

    public record Source(String evidenceId, String sectionPath, String text) {
    }

    public record TextItem(String ref, String changeType, String sectionPath, List<Source> sources) {
    }

    /** @param accountAliases 설명 후보를 찾을 때 쓴 검색어(AccountAliases). ai-server가 인용 확인에 쓴다 */
    public record FinancialItem(String ref, String accountName, String direction, List<String> accountAliases,
            List<Source> candidates) {
    }
}
