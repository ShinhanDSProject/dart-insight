package com.dartinsight.textevent.domain;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;

/**
 * 사건 문장 칸 하나(text_event_sentence, ADR-0060). 공시의 의미(MEANING)나 신호 이유(SIGNAL_REASON)다.
 *
 * @param status     GENERATED AI 문장, FALLBACK 기준표의 일반 문구(신호 이유만), FAILED 문장 없음(공시의 의미만)
 * @param failReason INVALID_OUTPUT, LLM_UNAVAILABLE, BUDGET_EXCEEDED. GENERATED면 null
 * @param model      마지막으로 부른 모델. 부르지 않았으면 null
 */
public record TextEventSentence(String status, String failReason, List<Item> items, String model,
        String promptVersion, LocalDateTime generatedAt) {

    public static final String MEANING = "MEANING";
    public static final String SIGNAL_REASON = "SIGNAL_REASON";
    public static final String GENERATED = "GENERATED";
    public static final String FALLBACK = "FALLBACK";
    public static final String FAILED = "FAILED";
    public static final String INVALID_OUTPUT = "INVALID_OUTPUT";
    /** 대체 표시의 일반 문구. 근거가 없다 */
    public static final String GENERAL = "GENERAL";
    private static final Set<String> MEANING_STATUSES = Set.of(GENERATED, FAILED);
    private static final Set<String> SIGNAL_REASON_STATUSES = Set.of(GENERATED, FALLBACK);

    /**
     * 문장 하나와 문장별 근거.
     *
     * @param absentTopics ABSENT 문장이 없다고 쓴 항목. 그 밖에는 빈 목록
     * @param evidenceIds  그 사건에 묶인 변경의 블록 근거 ID. GENERAL은 빈 목록
     */
    public record Item(String type, List<String> absentTopics, String text, List<String> evidenceIds) {
    }

    public boolean aiGenerated() {
        return GENERATED.equals(status);
    }

    /** 그 칸에 올 수 있는 상태인지 */
    public boolean validFor(String part) {
        return (MEANING.equals(part) ? MEANING_STATUSES : SIGNAL_REASON_STATUSES).contains(status);
    }

    /** AI 문장이면 문장마다 근거가 있고 모두 주어진 블록인지. 대체 표시·실패 칸은 근거가 없어 늘 참이다 */
    public boolean citesOnly(Set<String> blockEvidenceIds) {
        return !aiGenerated() || items.stream().allMatch(item -> item.evidenceIds() != null
                && !item.evidenceIds().isEmpty() && blockEvidenceIds.containsAll(item.evidenceIds()));
    }

    /** 근거가 어긋난 공시의 의미. 부른 기록은 남긴다 */
    public TextEventSentence failed() {
        return new TextEventSentence(FAILED, INVALID_OUTPUT, List.of(), model, promptVersion, generatedAt);
    }

    /** 근거가 어긋난 신호 이유. 기준표의 일반 문구로 바꾸고 부른 기록은 남긴다 */
    public TextEventSentence fallback(List<String> generalTexts) {
        return new TextEventSentence(FALLBACK, INVALID_OUTPUT,
                generalTexts.stream().map(text -> new Item(GENERAL, List.of(), text, List.of())).toList(), model,
                promptVersion, generatedAt);
    }
}
