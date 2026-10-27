package com.dartinsight.note.domain;

/** 판단 노트에 담은 근거의 종류(docs/erd.md judgment_note_item.kind). */
public enum NoteKind {
    /** 재무 계정 변화(financial_change) */
    FINANCIAL_CHANGE,
    /** 문장·표 변경(text_change) */
    TEXT_CHANGE
}
