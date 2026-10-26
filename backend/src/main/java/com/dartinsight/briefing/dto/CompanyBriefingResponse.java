package com.dartinsight.briefing.dto;

import com.dartinsight.briefing.domain.BriefingRecord;
import com.dartinsight.briefing.domain.BriefingSentence;
import com.dartinsight.briefing.domain.BriefingStatus;
import com.dartinsight.briefing.domain.BriefingUnavailableReason;
import com.dartinsight.report.domain.DartLinks;
import com.dartinsight.report.domain.Report;
import com.dartinsight.report.domain.ReportType;
import com.fasterxml.jackson.annotation.JsonFormat;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * AI 기업 브리핑(docs/api-spec.md GET /api/companies/{corpCode}/briefing).
 *
 * @param reason      NOT_AVAILABLE일 때 사유. 아니면 null
 * @param message     REVIEW_NEEDED·NOT_AVAILABLE일 때 안내. GENERATED면 null
 * @param report      브리핑의 원문 보고서. 정기보고서가 없으면 null
 * @param aiGenerated AI가 만든 결과면 true(화면 'AI 생성')
 * @param ai          AI가 만든 결과일 때만 모델·프롬프트 버전·생성 시각
 */
public record CompanyBriefingResponse(String corpCode, BriefingStatus status, BriefingUnavailableReason reason,
        String message, ReportRef report, List<Sentence> sentences, boolean aiGenerated, AiInfo ai) {

    public static CompanyBriefingResponse of(String corpCode, Report report, BriefingRecord row) {
        List<Sentence> sentences = new ArrayList<>();
        if (row.status() == BriefingStatus.GENERATED) {
            for (BriefingSentence sentence : row.sentences()) {
                sentences.add(new Sentence(sentences.size() + 1, sentence.text(), sentence.evidence().stream()
                        .map(e -> new Evidence(e.evidenceId(), row.rceptNo(), e.sectionNo(), e.blockNo(),
                                e.sectionPath(), e.quote()))
                        .toList()));
            }
        }
        String message = row.status() == BriefingStatus.GENERATED ? null
                : row.reviewReason() == null ? "근거를 확인하지 못해 브리핑을 보여 주지 않아요." : row.reviewReason();
        return new CompanyBriefingResponse(corpCode, row.status(), null, message, ReportRef.from(report), sentences,
                true, new AiInfo(row.model(), row.promptVersion(), row.generatedAt()));
    }

    public static CompanyBriefingResponse notAvailable(String corpCode, Report report,
            BriefingUnavailableReason reason) {
        return new CompanyBriefingResponse(corpCode, BriefingStatus.NOT_AVAILABLE, reason, reason.message(),
                report == null ? null : ReportRef.from(report), List.of(), false, null);
    }

    public record ReportRef(String rceptNo, String reportName, ReportType reportType, String dartUrl) {

        static ReportRef from(Report report) {
            return new ReportRef(report.getRceptNo(), report.getReportName(), report.getReportType(),
                    DartLinks.viewer(report.getRceptNo()));
        }
    }

    public record Sentence(int no, String text, List<Evidence> evidence) {
    }

    /** 인용한 원문 위치. quote는 인용 블록 앞 600자 */
    public record Evidence(String evidenceId, String rceptNo, int sectionNo, int blockNo, String sectionPath,
            String quote) {
    }

    public record AiInfo(String model, String promptVersion,
            @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss") LocalDateTime generatedAt) {
    }
}
