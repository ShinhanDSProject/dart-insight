package com.dartinsight.note.dto;

import com.dartinsight.company.domain.Company;
import com.dartinsight.note.domain.JudgmentNoteItem;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** GET /api/notes. 기업은 가장 최근에 담은 항목 순, 항목은 최근에 담은 순. */
public record NoteListResponse(List<CompanyNote> companies) {

    /**
     * 항목을 기업마다 묶는다. 기업 순서는 rows에서 처음 나온 순서다.
     *
     * @param rows      최근에 담은 순서의 항목
     * @param companies 고유번호 → 기업. 없는 기업은 이름이 null
     */
    public static NoteListResponse of(List<JudgmentNoteItem> rows, Map<String, Company> companies) {
        Map<String, List<NoteItemResponse>> byCompany = new LinkedHashMap<>();
        for (JudgmentNoteItem row : rows) {
            byCompany.computeIfAbsent(row.getCorpCode(), key -> new ArrayList<>())
                    .add(NoteItemResponse.from(row));
        }
        return new NoteListResponse(byCompany.entrySet().stream()
                .map(e -> new CompanyNote(e.getKey(), corpName(companies, e.getKey()), List.copyOf(e.getValue())))
                .toList());
    }

    private static String corpName(Map<String, Company> companies, String corpCode) {
        Company company = companies.get(corpCode);
        return company == null ? null : company.getCorpName();
    }

    public record CompanyNote(String corpCode, String corpName, List<NoteItemResponse> items) {
    }
}
