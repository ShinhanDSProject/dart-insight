package com.dartinsight.note.dto;

import java.util.List;

/** GET /api/notes. 기업은 가장 최근에 담은 항목 순, 항목은 최근에 담은 순. */
public record NoteListResponse(List<CompanyNote> companies) {

    public record CompanyNote(String corpCode, String corpName, List<NoteItemResponse> items) {
    }
}
