package com.dartinsight.community.service;

import com.dartinsight.analysis.domain.Analysis;
import com.dartinsight.analysis.service.AnalysisResultService;
import com.dartinsight.common.error.ApiException;
import com.dartinsight.community.domain.CommunityQuote;
import com.dartinsight.community.domain.QuoteCommand;
import com.dartinsight.community.repository.CommunityQuoteRepository;
import com.dartinsight.note.domain.NoteSnapshot;
import com.dartinsight.note.service.NoteSnapshotFactory;
import com.dartinsight.report.domain.Report;
import com.dartinsight.report.service.ReportService;
import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * 글에 붙이는 변경점 인용(6.6 #464). 사본은 판단 노트와 같은 방식(ADR-0034)으로 저장된 분석 결과에서 만들고,
 * 화면이 보낸 글은 쓰지 않는다(요청에는 종류와 원래 위치만 있다). 부른 쪽 트랜잭션 안에서 쓴다.
 */
@Component
@RequiredArgsConstructor
class PostQuotes {
    private static final String ANALYSIS_FIELD = "quote.analysisId";
    private static final String CHANGE_FIELD = "quote.changeId";

    private final NoteSnapshotFactory snapshotFactory;
    private final AnalysisResultService resultService;
    private final ReportService reportService;
    private final CommunityQuoteRepository quotes;

    /** 글을 저장하기 전에 부른다. 이 기업의 완료된 분석의 변경이 아니면 400이고 아무것도 저장하지 않는다 */
    Draft prepare(String corpCode, QuoteCommand command) {
        NoteSnapshot snapshot = snapshot(command);
        if (!corpCode.equals(snapshot.corpCode())) {
            throw ApiException.invalidInput(ANALYSIS_FIELD, "이 기업의 분석이 아닙니다.");
        }
        Analysis analysis = resultService.completed(command.analysisId());
        Map<String, Report> reports = reportService.reports(
                List.of(analysis.getPreviousRceptNo(), analysis.getCurrentRceptNo()));
        return new Draft(command, snapshot, reportName(reports, analysis.getPreviousRceptNo()),
                reportName(reports, analysis.getCurrentRceptNo()));
    }

    void save(long postId, Draft draft, LocalDateTime now) {
        quotes.save(CommunityQuote.create(postId, draft.command().kind(), draft.snapshot(),
                draft.previousReportName(), draft.currentReportName(), now));
    }

    /** 글 ID → 인용. 인용이 없는 글은 결과에 없다 */
    Map<Long, CommunityQuote> forPosts(Collection<Long> postIds) {
        if (postIds.isEmpty()) return Map.of();
        return quotes.findByPostIdIn(postIds).stream()
                .collect(Collectors.toMap(CommunityQuote::getPostId, Function.identity()));
    }

    /** 노트 사본 공장의 404·409를 이 API의 약속(400, 어느 필드가 잘못인지)으로 바꾼다 */
    private NoteSnapshot snapshot(QuoteCommand command) {
        try {
            return snapshotFactory.create(command.kind().noteKind(), command.analysisId(), command.changeId());
        } catch (ApiException e) {
            throw switch (e.errorCode()) {
                case ANALYSIS_NOT_FOUND -> ApiException.invalidInput(ANALYSIS_FIELD, "없는 분석입니다.");
                case ANALYSIS_NOT_READY -> ApiException.invalidInput(ANALYSIS_FIELD, "끝나지 않은 분석입니다.");
                case ANALYSIS_CHANGE_NOT_FOUND, ANALYSIS_TEXT_CHANGE_NOT_FOUND ->
                        ApiException.invalidInput(CHANGE_FIELD, "그 분석의 변경이 아닙니다.");
                default -> e;
            };
        }
    }

    /** 분석의 보고서는 저장돼 있어야 한다(분석을 만들 때 저장함) */
    private static String reportName(Map<String, Report> reports, String rceptNo) {
        Report report = reports.get(rceptNo);
        if (report == null) throw new IllegalStateException("분석의 보고서가 저장되어 있지 않습니다: " + rceptNo);
        return report.getReportName();
    }

    /** 글을 저장하기 전에 검증하고 만든 사본 */
    record Draft(QuoteCommand command, NoteSnapshot snapshot, String previousReportName, String currentReportName) {
    }
}
