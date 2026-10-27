package com.dartinsight.note.controller;

import com.dartinsight.common.web.ApiPaths;
import com.dartinsight.note.dto.NoteCreateRequest;
import com.dartinsight.note.dto.NoteItemResponse;
import com.dartinsight.note.dto.NoteListResponse;
import com.dartinsight.note.dto.NoteMemoRequest;
import com.dartinsight.note.service.JudgmentNoteService;
import com.dartinsight.note.service.JudgmentNoteService.NoteExport;
import jakarta.validation.Valid;
import java.nio.charset.StandardCharsets;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 내 판단 노트 API(docs/api-spec.md /api/notes, 6.5 #413). 로그인한 회원만 쓴다(SecurityConfig가 JWT를 요구).
 */
@RestController
@RequestMapping(ApiPaths.NOTES)
@RequiredArgsConstructor
public class JudgmentNoteController {
    private static final MediaType MARKDOWN = new MediaType("text", "markdown", StandardCharsets.UTF_8);

    private final JudgmentNoteService noteService;

    @GetMapping
    public NoteListResponse list(@AuthenticationPrincipal Jwt jwt, @RequestParam(required = false) String corpCode) {
        return noteService.list(userId(jwt), corpCode == null || corpCode.isBlank() ? null : corpCode.strip());
    }

    @PostMapping
    public ResponseEntity<NoteItemResponse> create(@AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody NoteCreateRequest request) {
        NoteItemResponse item = noteService.create(userId(jwt), request.kind(), request.analysisId(),
                request.changeId(), request.memo());
        return ResponseEntity.status(HttpStatus.CREATED).body(item);
    }

    @PutMapping(ApiPaths.NOTE_MEMO)
    public NoteItemResponse updateMemo(@AuthenticationPrincipal Jwt jwt, @PathVariable Long itemId,
            @Valid @RequestBody NoteMemoRequest request) {
        return noteService.updateMemo(userId(jwt), itemId, request.memo());
    }

    @DeleteMapping(ApiPaths.BY_NOTE_ITEM_ID)
    public ResponseEntity<Void> delete(@AuthenticationPrincipal Jwt jwt, @PathVariable Long itemId) {
        noteService.delete(userId(jwt), itemId);
        return ResponseEntity.noContent().build();
    }

    /** Markdown 파일로 내려받는다. 에러는 다른 API와 같은 JSON이다 */
    @GetMapping(ApiPaths.NOTE_EXPORT)
    public ResponseEntity<String> export(@AuthenticationPrincipal Jwt jwt,
            @RequestParam(required = false) String corpCode) {
        NoteExport export = noteService.export(userId(jwt), corpCode == null ? null : corpCode.strip());
        return ResponseEntity.ok()
                .contentType(MARKDOWN)
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment().filename(export.fileName()).build().toString())
                .body(export.markdown());
    }

    private static long userId(Jwt jwt) {
        return Long.parseLong(jwt.getSubject());
    }
}
