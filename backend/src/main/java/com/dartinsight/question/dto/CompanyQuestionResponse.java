package com.dartinsight.question.dto;

import com.dartinsight.question.domain.CompanyQuestionRecord;
import com.dartinsight.question.domain.QuestionStatus;
import com.dartinsight.report.domain.DartLinks;
import com.dartinsight.report.domain.Report;
import com.fasterxml.jackson.annotation.JsonFormat;
import java.time.LocalDateTime;
import java.util.List;

/**
 * 기업 질문 하나와 답(docs/api-spec.md POST·GET /api/companies/{corpCode}/questions, ADR-0029).
 *
 * @param answer      답. 문장 안의 [1]은 citations[].no. ANSWERED가 아니면 null
 * @param message     답이 없을 때의 안내. ANSWERED면 null
 * @param citations   답이 인용한 원문(번호 순서). ANSWERED가 아니면 빈 배열
 * @param report      답한 보고서
 * @param aiGenerated AI가 답을 만들었으면 true(화면 'AI 생성')
 * @param ai          AI가 답을 만들었을 때만 모델·프롬프트 버전·생성 시각
 */
public record CompanyQuestionResponse(Long questionId, String question, QuestionStatus status, String answer,
        String message, List<Citation> citations, ReportRef report, boolean aiGenerated, AiInfo ai,
        @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss") LocalDateTime createdAt) {

    static final String NOT_FOUND_MESSAGE = "사업보고서에서 질문과 관련된 문단을 찾지 못했어요. "
            + "다른 말로 물어보거나 원문에서 직접 확인해 주세요.";

    public static CompanyQuestionResponse of(CompanyQuestionRecord row, Report report, List<Citation> citations) {
        boolean answered = row.status() == QuestionStatus.ANSWERED;
        boolean generated = row.model() != null
                && (answered || row.status() == QuestionStatus.REVIEW_NEEDED);
        return new CompanyQuestionResponse(row.id(), row.question(), row.status(), answered ? row.answer() : null,
                message(row.status()), answered ? citations : List.of(), ReportRef.from(report), generated,
                generated ? new AiInfo(row.model(), row.promptVersion(), row.generatedAt()) : null,
                row.createdAt());
    }

    private static String message(QuestionStatus status) {
        return status == QuestionStatus.NOT_FOUND ? NOT_FOUND_MESSAGE : status.message();
    }

    /**
     * 인용한 원문 위치.
     *
     * @param quote 문단 앞 160자
     */
    public record Citation(int no, String evidenceId, String rceptNo, Integer sectionNo, Integer blockNo,
            String sectionPath, String quote) {
    }

    public record ReportRef(String rceptNo, String reportName, String dartUrl) {

        public static ReportRef from(Report report) {
            return report == null ? null
                    : new ReportRef(report.getRceptNo(), report.getReportName(), DartLinks.viewer(report.getRceptNo()));
        }
    }

    public record AiInfo(String model, String promptVersion,
            @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss") LocalDateTime generatedAt) {
    }
}
