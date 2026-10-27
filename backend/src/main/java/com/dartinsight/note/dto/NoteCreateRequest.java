package com.dartinsight.note.dto;

import com.dartinsight.note.domain.NoteKind;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

/** POST /api/notes. 사본은 backend가 analysisId·changeId로 저장된 결과에서 만든다(ADR-0034). */
public record NoteCreateRequest(
        @NotNull(message = "담을 근거의 종류가 필요합니다.") NoteKind kind,
        @NotNull(message = "분석 ID가 필요합니다.") @Positive(message = "1 이상이어야 합니다.") Long analysisId,
        @NotNull(message = "변경 ID가 필요합니다.") @Positive(message = "1 이상이어야 합니다.") Long changeId,
        @Size(max = NoteMemoRequest.MAX_MEMO, message = "메모는 1,000자 이하로 써 주세요.") String memo) {
}
