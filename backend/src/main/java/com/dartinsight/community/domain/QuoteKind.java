package com.dartinsight.community.domain;

import com.dartinsight.note.domain.NoteKind;

/** 글에 붙일 수 있는 변경점 종류(docs/erd.md community_quote.kind). AI 답 인용은 붙이지 않는다(#464 범위 밖). */
public enum QuoteKind {
    /** 재무 계정 변화(financial_change) */
    FINANCIAL_CHANGE,
    /** 문장·표 변경(text_change) */
    TEXT_CHANGE;

    /** 사본은 판단 노트와 같은 방식으로 만든다(ADR-0034) */
    public NoteKind noteKind() {
        return NoteKind.valueOf(name());
    }
}
