package com.dartinsight.activity.domain;

import java.util.List;

/**
 * 저장하고 화면에 내보내는 요약과 카드(period_activity.payload JSON, ADR-0067).
 *
 * @param overview       이 기간 요약. 카드가 없거나 요약이 검사를 통과하지 못했으면 null
 * @param droppedCount   검사를 통과하지 못해 뺀 카드 수(AI 서버가 뺀 수와 backend가 근거를 확인하지 못해 뺀 수의 합)
 * @param candidateCount 후보 규칙으로 고른 변경 수
 */
public record ActivityPayload(Overview overview, List<Item> items, int droppedCount, int candidateCount) {

    public static final ActivityPayload EMPTY = new ActivityPayload(null, List.of(), 0, 0);

    public record Overview(String text, List<Evidence> evidence) {
    }

    /**
     * @param signal    POSITIVE·CAUTION·HOLD. 기준표로 코드가 붙인 값(ADR-0060)
     * @param changeIds 카드가 기댄 문장 변경 ID(중복 없음)
     */
    public record Item(int no, String area, List<String> audiences, String title, String summary,
            List<Quote> facts, String signal, String holdReason, String signalKind, String signalKindName,
            String signalChange, String signalChangeName, List<Impact> impacts, List<Long> changeIds) {
    }

    public record Quote(String quote, Evidence evidence) {
    }

    /**
     * @param kind DISCLOSED·OUTLOOK·CHECK
     * @param tone OUTLOOK만 GOOD·BAD, 그 밖에는 null
     */
    public record Impact(String kind, String tone, String text, List<Quote> premises) {
    }

    /**
     * 인용이 든 원문 위치.
     *
     * @param side     PREVIOUS(이전 보고서)·CURRENT(이번 보고서)
     * @param changeId 그 인용이 든 문장 변경(text_change.id)
     */
    public record Evidence(String evidenceId, String rceptNo, Integer blockNo, String side, String sectionPath,
            Long changeId) {
    }
}
