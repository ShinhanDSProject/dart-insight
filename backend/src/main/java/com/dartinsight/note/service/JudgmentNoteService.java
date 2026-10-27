package com.dartinsight.note.service;

import com.dartinsight.common.error.ApiException;
import com.dartinsight.common.error.ErrorCode;
import com.dartinsight.company.domain.Company;
import com.dartinsight.company.service.CompanyService;
import com.dartinsight.note.domain.JudgmentNoteItem;
import com.dartinsight.note.domain.NoteSnapshot;
import com.dartinsight.note.dto.NoteCreateRequest;
import com.dartinsight.note.dto.NoteItemResponse;
import com.dartinsight.note.dto.NoteListResponse;
import com.dartinsight.note.dto.NoteListResponse.CompanyNote;
import com.dartinsight.note.repository.JudgmentNoteItemRepository;
import com.dartinsight.user.UserService;
import java.time.Clock;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 로그인한 회원의 판단 노트(6.5, #413, ADR-0034). 회원은 언제나 토큰의 사용자 ID로만 정해,
 * 다른 회원의 항목은 읽거나 바꾸거나 지울 수 없다(없는 항목과 같이 404).
 * 노트 내용(사본·메모)은 AI 서버·LLM에 보내지 않는다.
 */
@Service
@RequiredArgsConstructor
public class JudgmentNoteService {
    private static final Pattern CORP_CODE = Pattern.compile("\\d{8}");

    private final JudgmentNoteItemRepository items;
    private final NoteSnapshotFactory snapshots;
    private final CompanyService companyService;
    private final UserService userService;
    private final Clock clock;

    /** corpCode가 null이면 모든 기업. 기업은 가장 최근에 담은 항목 순 */
    @Transactional(readOnly = true)
    public NoteListResponse list(long userId, String corpCode) {
        userService.requireExisting(userId);
        List<JudgmentNoteItem> rows = corpCode == null
                ? items.findByUserIdOrderByCreatedAtDescIdDesc(userId)
                : items.findByUserIdAndCorpCodeOrderByCreatedAtDescIdDesc(userId, requireCorpCode(corpCode));
        Map<String, List<NoteItemResponse>> byCompany = new LinkedHashMap<>();
        for (JudgmentNoteItem row : rows) {
            byCompany.computeIfAbsent(row.getCorpCode(), key -> new ArrayList<>())
                    .add(NoteItemResponse.from(row));
        }
        Map<String, Company> companies = companyService.getAll(byCompany.keySet()).stream()
                .collect(Collectors.toMap(Company::getCorpCode, Function.identity()));
        return new NoteListResponse(byCompany.entrySet().stream()
                .map(e -> new CompanyNote(e.getKey(), corpName(companies, e.getKey()), List.copyOf(e.getValue())))
                .toList());
    }

    /**
     * 사본은 저장된 분석 결과에서 만든다. 근거를 찾는 동안(원문·보고서 조회) 트랜잭션을 잡지 않고 저장만 묶는다(LY-2).
     */
    public NoteItemResponse create(long userId, NoteCreateRequest request) {
        userService.requireExisting(userId);
        NoteSnapshot snapshot = switch (request.kind()) {
            case FINANCIAL_CHANGE, TEXT_CHANGE -> snapshots.create(request.kind(), request.analysisId(),
                    required("changeId", request.changeId()));
            case ANSWER_CITATION -> {
                long questionId = required("questionId", request.questionId());
                int citationNo = required("citationNo", request.citationNo());
                yield snapshots.answerCitation(request.analysisId(), questionId, citationNo);
            }
        };
        JudgmentNoteItem saved = items.save(
                JudgmentNoteItem.create(userId, snapshot, normalizeMemo(request.memo()), LocalDateTime.now(clock)));
        return NoteItemResponse.from(saved);
    }

    /** 종류에 따라 있어야 하는 요청 값 */
    private static <T> T required(String field, T value) {
        if (value == null) {
            throw ApiException.invalidInput(field, "필수 값입니다.");
        }
        return value;
    }

    @Transactional
    public NoteItemResponse updateMemo(long userId, long itemId, String memo) {
        userService.requireExisting(userId);
        JudgmentNoteItem item = findOwnedOrThrow(userId, itemId);
        item.changeMemo(normalizeMemo(memo), LocalDateTime.now(clock));
        return NoteItemResponse.from(item);
    }

    /** 항목 하나만 지운다(AC6) */
    @Transactional
    public void delete(long userId, long itemId) {
        userService.requireExisting(userId);
        items.delete(findOwnedOrThrow(userId, itemId));
    }

    /** 기업 노트를 출처와 함께 Markdown으로(AC5) */
    @Transactional(readOnly = true)
    public NoteExport export(long userId, String corpCode) {
        userService.requireExisting(userId);
        if (corpCode == null || corpCode.isBlank()) {
            throw ApiException.invalidInput("corpCode", "필수 값입니다.");
        }
        Company company = companyService.get(requireCorpCode(corpCode));
        List<NoteItemResponse> rows = items.findByUserIdAndCorpCodeOrderByCreatedAtDescIdDesc(userId, corpCode)
                .stream().map(NoteItemResponse::from).toList();
        String markdown = NoteMarkdown.write(company.getCorpName(), corpCode, rows, LocalDateTime.now(clock));
        return new NoteExport("judgment-note-" + corpCode + ".md", markdown);
    }

    private JudgmentNoteItem findOwnedOrThrow(long userId, long itemId) {
        return items.findByIdAndUserId(itemId, userId)
                .orElseThrow(() -> new ApiException(ErrorCode.COMPANY_NOTE_NOT_FOUND));
    }

    private static String requireCorpCode(String corpCode) {
        if (!CORP_CODE.matcher(corpCode).matches()) {
            throw ApiException.invalidInput("corpCode", "8자리 숫자여야 합니다.");
        }
        return corpCode;
    }

    private static String corpName(Map<String, Company> companies, String corpCode) {
        Company company = companies.get(corpCode);
        return company == null ? null : company.getCorpName();
    }

    /** 앞뒤 공백을 지우고, 비었으면 null */
    private static String normalizeMemo(String memo) {
        if (memo == null) {
            return null;
        }
        String trimmed = memo.strip();
        return trimmed.isEmpty() ? null : trimmed;
    }

    public record NoteExport(String fileName, String markdown) {
    }
}
