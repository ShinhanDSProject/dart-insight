package com.dartinsight.textevent.domain;

import java.util.List;
import java.util.Map;

/**
 * 사건 신호 기준표(GET /internal/signal-tables/current, ADR-0060). 파일은 ai-server에만 있고 backend는 받은 것을 버전별로 둔다.
 *
 * @param glossary 출처를 확인한 용어 풀이만
 */
public record SignalTable(String version, String signalNotice, List<Kind> kinds, List<GlossaryTerm> glossary) {

    /**
     * 사건 종류 하나.
     *
     * @param accountsByType 투자 유형별로 계정을 나눈 종류만. 그 밖에는 null
     * @param generalSides   MIXED 변화가 있는 종류의 좋은 면·나쁜 면 일반 문구. 그 밖에는 null
     */
    public record Kind(String code, String name, boolean front, List<Change> changes, List<String> accounts,
            Map<String, List<String>> accountsByType, Sides generalSides) {
    }

    /**
     * @param signal  CAUTION, POSITIVE, MIXED, null(기준 없음)
     * @param general CAUTION·POSITIVE 변화의 일반 문구. 그 밖에는 null
     */
    public record Change(String code, String name, String signal, boolean explicitOnly, String general) {
    }

    public record Sides(String good, String bad) {
    }

    /**
     * 신호 이유를 대체 표시로 바꿀 때의 일반 문구(ai-server signal_reason.fallback과 같은 규칙). 주의·긍정은 그 변화의 문구
     * 하나, 좋은 면·나쁜 면이 함께 있는 보류는 좋은 면, 나쁜 면 순서로 두 개, 그 밖에는 없다.
     */
    public List<String> generalTexts(TextEventSignal signal) {
        Kind kind = kinds.stream().filter(k -> k.code().equals(signal.kindCode())).findFirst().orElse(null);
        if (kind == null) {
            return List.of();
        }
        if (signal.signed()) {
            return kind.changes().stream().filter(c -> c.code().equals(signal.changeCode()) && c.general() != null)
                    .map(Change::general).limit(1).toList();
        }
        if (TextEventSignal.MIXED_SIDES.equals(signal.holdReason()) && kind.generalSides() != null) {
            return List.of(kind.generalSides().good(), kind.generalSides().bad());
        }
        return List.of();
    }
}
