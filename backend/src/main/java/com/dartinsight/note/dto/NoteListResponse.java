package com.dartinsight.note.dto;

import com.dartinsight.analysis.domain.CompletedAnalysis;
import com.dartinsight.company.domain.Company;
import com.dartinsight.comparison.domain.ComparisonBasis;
import com.dartinsight.disclosure.domain.Disclosure;
import com.dartinsight.disclosure.domain.DisclosureGroup;
import com.dartinsight.note.domain.JudgmentNoteItem;
import com.dartinsight.note.domain.NoteFollowupMatcher;
import com.dartinsight.report.domain.DartLinks;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** GET /api/notes. 기업은 가장 최근에 담은 항목 순, 항목은 최근에 담은 순. */
public record NoteListResponse(List<CompanyNote> companies) {

    /**
     * 항목을 기업마다 묶고, 저장된 후속 분석·공시를 함께 담는다. 기업 순서는 rows에서 처음 나온 순서다.
     *
     * @param rows              최근에 담은 순서의 항목
     * @param companies         고유번호 → 기업. 없는 기업은 이름이 null
     * @param completedAnalyses 고유번호 → 저장된 완료 분석
     * @param disclosures       고유번호 → 저장된 공시
     */
    public static NoteListResponse of(List<JudgmentNoteItem> rows, Map<String, Company> companies,
            Map<String, List<CompletedAnalysis>> completedAnalyses,
            Map<String, List<Disclosure>> disclosures) {
        Map<String, List<JudgmentNoteItem>> byCompany = new LinkedHashMap<>();
        for (JudgmentNoteItem row : rows) {
            byCompany.computeIfAbsent(row.getCorpCode(), key -> new ArrayList<>()).add(row);
        }
        return new NoteListResponse(byCompany.entrySet().stream()
                .map(e -> CompanyNote.of(
                        e.getKey(),
                        corpName(companies, e.getKey()),
                        e.getValue(),
                        completedAnalyses.getOrDefault(e.getKey(), List.of()),
                        disclosures.getOrDefault(e.getKey(), List.of())))
                .toList());
    }

    private static String corpName(Map<String, Company> companies, String corpCode) {
        Company company = companies.get(corpCode);
        return company == null ? null : company.getCorpName();
    }

    public record CompanyNote(
            String corpCode,
            String corpName,
            List<NewerAnalysis> newerAnalyses,
            List<NewerDisclosure> newerDisclosures,
            List<NoteItemResponse> items) {

        static CompanyNote of(String corpCode, String corpName, List<JudgmentNoteItem> companyRows,
                List<CompletedAnalysis> completedAnalyses, List<Disclosure> disclosures) {
            List<NewerAnalysis> newerAnalyses = NoteFollowupMatcher.newerAnalyses(companyRows, completedAnalyses)
                    .stream()
                    .map(NewerAnalysis::from)
                    .toList();
            List<NewerDisclosure> newerDisclosures = NoteFollowupMatcher.newerDisclosures(companyRows, disclosures)
                    .stream()
                    .map(NewerDisclosure::from)
                    .toList();
            List<NoteItemResponse> items = companyRows.stream()
                    .map(row -> NoteItemResponse.from(row, disclosures))
                    .toList();
            return new CompanyNote(corpCode, corpName, newerAnalyses, newerDisclosures, items);
        }
    }

    /** 담은 근거 보고서 이후에 완료된 새 분석(#504) */
    public record NewerAnalysis(
            long analysisId,
            ComparisonBasis basis,
            String previousReportName,
            String currentRceptNo,
            String currentReportName) {

        static NewerAnalysis from(CompletedAnalysis completed) {
            return new NewerAnalysis(
                    completed.analysis().getId(),
                    completed.analysis().getBasis(),
                    completed.previous().getReportName(),
                    completed.analysis().getCurrentRceptNo(),
                    completed.current().getReportName());
        }
    }

    /** 담은 근거 보고서 이후에 접수된 공시(#504) */
    public record NewerDisclosure(
            String rceptNo,
            String reportName,
            LocalDate rceptDt,
            DisclosureGroup disclosureGroup,
            String dartUrl) {

        static NewerDisclosure from(Disclosure disclosure) {
            return new NewerDisclosure(
                    disclosure.rceptNo(),
                    disclosure.displayName(),
                    disclosure.rceptDt(),
                    disclosure.group(),
                    DartLinks.viewer(disclosure.rceptNo()));
        }
    }
}
