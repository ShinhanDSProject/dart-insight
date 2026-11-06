package com.dartinsight.textevent.domain;

import java.util.List;
import java.util.Set;

/**
 * 사건의 신호(ADR-0060). AI가 고른 종류·변화로 ai-server 코드가 기준표에서 붙인 값이고, backend는 정해진 값인지만 다시 본다.
 *
 * @param signal     CAUTION, POSITIVE, HOLD
 * @param holdReason HOLD일 때만 NO_CRITERIA, EVIDENCE_NOT_CONFIRMED, MIXED_SIDES, MIXED_LITIGATION
 * @param evidenceId 종류·변화의 근거(그 사건 인용의 근거 ID). 근거가 없으면 null
 * @param rowCounts  묶인 표 변경의 행 비교를 더한 값. 행을 비교한 표가 없으면 null
 */
public record TextEventSignal(String kindCode, String changeCode, String changeName, String signal,
        String holdReason, String evidenceId, RowCounts rowCounts) {

    public static final String CAUTION = "CAUTION";
    public static final String POSITIVE = "POSITIVE";
    public static final String HOLD = "HOLD";
    /** 목록의 신호 순서(docs/api-spec.md signalCounts) */
    public static final List<String> SIGNALS = List.of(CAUTION, POSITIVE, HOLD);
    public static final String MIXED_SIDES = "MIXED_SIDES";
    private static final Set<String> HOLD_REASONS = Set.of("NO_CRITERIA", "EVIDENCE_NOT_CONFIRMED", MIXED_SIDES,
            "MIXED_LITIGATION");

    public record RowCounts(int changed, int added, int missing) {
    }

    /** 정해진 신호 값인지. 보류 사유는 보류일 때만 있다 */
    public boolean valid() {
        if (!SIGNALS.contains(signal)) {
            return false;
        }
        return HOLD.equals(signal) ? HOLD_REASONS.contains(holdReason) : holdReason == null;
    }

    /** 주의·긍정인지(신호 이유가 그 변화의 일반 문구로 대체되는 신호) */
    public boolean signed() {
        return CAUTION.equals(signal) || POSITIVE.equals(signal);
    }
}
