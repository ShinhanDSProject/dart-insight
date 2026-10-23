package com.dartinsight.analysis;

import com.dartinsight.common.error.ApiException;
import com.dartinsight.common.error.ErrorCode;
import com.dartinsight.comparison.domain.ComparisonBasis;
import com.dartinsight.summary.SummaryResult;
import com.dartinsight.summary.SummaryStore;
import java.time.Clock;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 분석 결과 저장·조회(4.3).
 * <ul>
 *   <li>결과는 기업·현재 보고서·이전 보고서·비교 기준·분석 버전으로 식별한다.</li>
 *   <li>같은 조건으로 완료된 분석이 있으면 다시 쓰고, 진행 중이면 그 분석을 돌려준다. 실패한 분석과 멈춘 분석은 다시 쓰지 않는다.</li>
 *   <li>정정 공시는 접수번호가 달라 새 분석이 된다. 기존 결과를 덮어쓰지 않는다.</li>
 *   <li>결과 저장과 완료 표시는 한 트랜잭션이다. 저장이 실패하면 완료로 바뀌지 않는다.</li>
 * </ul>
 */
@Service
@RequiredArgsConstructor
public class AnalysisResultService {

    /** 이 시간 넘게 상태가 바뀌지 않은 진행 중 분석은 멈춘 것으로 본다(OpenDART 호출이 가장 오래 걸리는 경우보다 길게). */
    static final Duration STALE_AFTER = Duration.ofMinutes(30);
    static final String STALE_CODE = "ANALYSIS_TIMED_OUT";

    private final AnalysisRepository analysisRepository;
    private final FinancialChangeRepository changeRepository;
    private final TextChangeStore textChangeStore;
    private final SummaryStore summaryStore;
    private final Clock clock;

    /**
     * 같은 조건에서 다시 쓸 분석. 완료된 것이 있으면 그것, 없으면 진행 중인 것.
     * 진행 중인데 {@link #STALE_AFTER} 넘게 상태가 바뀌지 않은 분석은 멈춘 것으로 보고 실패로 바꾼 뒤 다시 쓰지 않는다
     * (서버가 실행 도중 내려가는 등). 그래야 같은 조건으로 다시 요청할 수 있다.
     * 문장 비교가 실패로 끝난 결과도 다시 쓰지 않는다. AI 서버·OpenDART의 일시 장애였으면 다시 요청해 원문을 다시
     * 비교할 수 있어야 하고, 화면도 '다시 요청하면 비교한다'고 안내한다.
     */
    @Transactional
    public Optional<Analysis> findReusable(String corpCode, String currentRceptNo, String previousRceptNo,
            ComparisonBasis basis) {
        List<Analysis> same = analysisRepository
                .findByCorpCodeAndCurrentRceptNoAndPreviousRceptNoAndBasisAndAnalysisVersionOrderByIdDesc(corpCode,
                        currentRceptNo, previousRceptNo, basis, Analysis.CURRENT_VERSION);
        Optional<Analysis> completed = same.stream()
                .filter(a -> a.getStatus() == AnalysisStatus.COMPLETED && a.getTextStatus() != TextStatus.FAILED)
                .findFirst();
        if (completed.isPresent()) {
            return completed;
        }
        LocalDateTime now = now();
        LocalDateTime staleBefore = now.minus(STALE_AFTER);
        for (Analysis analysis : same) {
            if (!analysis.getStatus().finished() && analysis.getUpdatedAt().isBefore(staleBefore)) {
                analysis.fail(STALE_CODE, "분석이 오래 진행되지 않아 멈춘 것으로 봤어요. 다시 요청해 주세요.", now);
            }
        }
        return same.stream().filter(a -> !a.getStatus().finished()).findFirst();
    }

    /**
     * 결과(재무 수치·문장 변경·요약)를 저장하고 같은 트랜잭션에서 완료로 바꾼다.
     * 저장하다 실패하면 트랜잭션이 되돌아가 완료가 되지 않는다.
     */
    @Transactional
    public void saveAndComplete(Long analysisId, List<FinancialChangeRow> rows, TextComparison text,
            SummaryResult summary) {
        Analysis analysis = get(analysisId);
        List<FinancialChange> saved = changeRepository.saveAll(
                rows.stream().map(row -> FinancialChange.of(analysisId, row)).toList());
        changeRepository.flush();
        textChangeStore.saveAll(analysisId, text.rows());
        summaryStore.save(analysisId, summary, saved.stream().map(FinancialChange::getId).toList());
        analysis.recordText(text.status(), text.message());
        analysis.recordSummary(summary.status(), summary.message());
        analysis.complete(now());
    }

    /** 요약 없이 저장하는 경우(요약할 변화가 없거나 테스트 자료) */
    @Transactional
    public void saveAndComplete(Long analysisId, List<FinancialChangeRow> rows, TextComparison text) {
        saveAndComplete(analysisId, rows, text, SummaryResult.empty("요약하지 않았어요."));
    }

    /** 재무 수치만 저장하는 경우(문장 비교를 하지 않은 테스트 자료 등). 문장 비교는 실패로 남긴다. */
    @Transactional
    public void saveAndComplete(Long analysisId, List<FinancialChangeRow> rows) {
        saveAndComplete(analysisId, rows, TextComparison.failed("문장을 비교하지 않았어요."));
    }

    /** 완료된 분석. 완료되지 않았으면 409 */
    @Transactional(readOnly = true)
    public Analysis completed(Long analysisId) {
        Analysis analysis = get(analysisId);
        if (analysis.getStatus() != AnalysisStatus.COMPLETED) {
            throw new ApiException(ErrorCode.ANALYSIS_NOT_READY);
        }
        return analysis;
    }

    @Transactional(readOnly = true)
    public Analysis get(Long analysisId) {
        return analysisRepository.findById(analysisId)
                .orElseThrow(() -> new ApiException(ErrorCode.ANALYSIS_NOT_FOUND));
    }

    /** 완료된 분석의 계정별 결과. 완료되지 않았으면 409. 이 분석의 결과만 돌려준다. */
    @Transactional(readOnly = true)
    public CompletedResult completedResult(Long analysisId) {
        Analysis analysis = get(analysisId);
        if (analysis.getStatus() != AnalysisStatus.COMPLETED) {
            throw new ApiException(ErrorCode.ANALYSIS_NOT_READY);
        }
        return new CompletedResult(analysis, changeRepository.findByAnalysisIdOrderBySjDivAscDisplayOrderAsc(analysisId));
    }

    /** 완료된 분석의 계정 하나. 다른 분석의 항목이면 404. */
    @Transactional(readOnly = true)
    public CompletedChange completedChange(Long analysisId, Long changeId) {
        Analysis analysis = get(analysisId);
        if (analysis.getStatus() != AnalysisStatus.COMPLETED) {
            throw new ApiException(ErrorCode.ANALYSIS_NOT_READY);
        }
        FinancialChange change = changeRepository.findByIdAndAnalysisId(changeId, analysisId)
                .orElseThrow(() -> new ApiException(ErrorCode.ANALYSIS_CHANGE_NOT_FOUND));
        return new CompletedChange(analysis, change);
    }

    /** 재무 수치 결과 하나의 재무제표 구분(sj_div). 없으면 빈 값 */
    @Transactional(readOnly = true)
    public Optional<String> financialSjDiv(Long changeId) {
        return changeRepository.findById(changeId).map(FinancialChange::getSjDiv);
    }

    /** 분석 안의 변경 번호(change_no)로 찾은 문장 변경 ID. 없으면 빈 값 */
    @Transactional(readOnly = true)
    public Optional<Long> textChangeId(Long analysisId, int changeNo) {
        return textChangeStore.idOf(analysisId, changeNo);
    }

    public record CompletedResult(Analysis analysis, List<FinancialChange> changes) {
    }

    public record CompletedChange(Analysis analysis, FinancialChange change) {
    }

    private LocalDateTime now() {
        return LocalDateTime.now(clock).truncatedTo(ChronoUnit.MICROS);
    }
}
