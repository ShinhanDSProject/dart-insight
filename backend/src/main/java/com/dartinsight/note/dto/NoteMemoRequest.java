package com.dartinsight.note.dto;

import jakarta.validation.constraints.Size;

/** PUT /api/notes/{itemId}/memo. null이거나 비었으면 메모를 지운다. */
public record NoteMemoRequest(
        @Size(max = MAX_MEMO, message = "메모는 1,000자 이하로 써 주세요.") String memo) {

    public static final int MAX_MEMO = 1000;
}
