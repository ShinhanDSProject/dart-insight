package com.dartinsight.textevent.dto;

import java.math.BigDecimal;
import java.util.List;

/** 주요 사건 응답(POST /internal/text-events, docs/api-spec.md 3장). 저장 전에 backend가 다시 확인한다. */
public record TextEventAiResponse(boolean created, String notCreatedReason, String model, String promptVersion,
        String signalTableVersion, String generatedAt, int droppedEventCount, List<Event> events,
        List<Integer> unboundChangeNos, List<Call> calls) {

    /** 신호·문장 칸의 값과 뜻은 공개 API GET .../events와 같다(ADR-0060) */
    public record Event(int sortOrder, String title, String kind, List<Integer> changeNos, List<Quote> quotes,
            Long scaleAmount, String scaleAmountText, String currency, Long scaleAmountKrw, BigDecimal scaleRatio,
            String scaleNotComputedReason, String scaleEvidenceId, String amountSource, String fxSource,
            String fxRateDate, String sortBasis, String kindCode, String changeCode, String changeName,
            String signal, String holdReason, String signalEvidenceId, RowCounts rowCounts,
            List<FactAccount> factAccounts, Sentence meaning, Sentence signalReason, List<Term> glossary) {
    }

    public record Quote(int changeNo, String purpose, String side, String text, String evidenceId) {
    }

    public record RowCounts(int changed, int added, int missing) {
    }

    public record FactAccount(String accountType, String accountName) {
    }

    /** 사건 문장 칸. 만들지 않은 칸은 null로 온다 */
    public record Sentence(String status, String failReason, List<SentenceItem> items, String model,
            String promptVersion, String generatedAt) {
    }

    /** @param absentTopics 공시의 의미에만 온다 */
    public record SentenceItem(String type, List<String> absentTopics, String text, List<String> evidenceIds) {
    }

    public record Term(String term, String meaning, String source) {
    }

    public record Call(String task, String provider, String model, String promptVersion, String calledAt,
            String traceId, Integer inputTokens, Integer outputTokens, Integer latencyMs, Integer attempt,
            String outcome, String error) {
    }
}
