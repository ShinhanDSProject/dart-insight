package com.dartinsight.community.domain;

import com.dartinsight.common.error.ApiException;
import java.util.Map;

/**
 * 글 쓰기 요청의 인용(API 명세 POST /api/companies/{corpCode}/posts의 quote). 종류와 원래 위치만 받고,
 * 이름·글은 받지 않는다(backend가 저장된 분석 결과로 사본을 만든다).
 */
public record QuoteCommand(QuoteKind kind, long analysisId, long changeId) {

    /**
     * 요청 본문의 quote를 검증한다. 없으면(null) null. 숫자 문자열("42")이나 소수는 받지 않는다.
     */
    public static QuoteCommand of(Object raw) {
        if (raw == null) return null;
        if (!(raw instanceof Map<?, ?> quote)) {
            throw ApiException.invalidInput("quote", "kind·analysisId·changeId를 담은 객체여야 합니다.");
        }
        return new QuoteCommand(kind(quote.get("kind")), id(quote.get("analysisId"), "quote.analysisId"),
                id(quote.get("changeId"), "quote.changeId"));
    }

    private static QuoteKind kind(Object raw) {
        if (raw instanceof String value) {
            for (QuoteKind kind : QuoteKind.values()) {
                if (kind.name().equals(value)) return kind;
            }
        }
        throw ApiException.invalidInput("quote.kind", "FINANCIAL_CHANGE 또는 TEXT_CHANGE여야 합니다.");
    }

    private static long id(Object raw, String field) {
        if ((raw instanceof Integer || raw instanceof Long) && ((Number) raw).longValue() > 0) {
            return ((Number) raw).longValue();
        }
        throw ApiException.invalidInput(field, "1 이상의 정수여야 합니다.");
    }
}
