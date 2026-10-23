package com.dartinsight.analysis;

import com.dartinsight.common.error.ApiException;
import com.dartinsight.common.error.ErrorCode;
import com.dartinsight.common.trace.TraceContext;
import com.dartinsight.comparison.ComparabilityService;
import com.dartinsight.comparison.ComparabilityService.ComparabilityResult;
import com.dartinsight.comparison.ComparisonBasis;
import com.dartinsight.comparison.ReportPairService;
import com.dartinsight.report.domain.Report;
import com.dartinsight.report.service.ReportService;
import java.time.Clock;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;
import org.springframework.stereotype.Service;

/**
 * 분석 요청(2.3).
 * <ul>
 *   <li>같은 조건으로 완료된 결과가 있으면 새로 만들지 않고 돌려준다(reused).</li>
 *   <li>진행 중인 분석이 있으면 그 분석을 돌려준다(중복 수집·분석을 막음).</li>
 *   <li>비교 가능성 검증(2.2)을 통과하지 못하면 만들지 않고 422.</li>
 *   <li>전년 동기·직전 기간과 맞지 않는 보고서 쌍은 직접 선택으로 저장한다.</li>
 * </ul>
 */
@Service
public class AnalysisService {

    private final AnalysisResultService resultService;
    private final AnalysisRepository analysisRepository;
    private final ComparabilityService comparabilityService;
    private final AnalysisRunner runner;
    private final ReportService reportService;
    private final Clock clock;
    /** 같은 조건의 요청이 동시에 와도 분석을 하나만 만들도록 조건별로 잠근다(서버 한 대 기준). 찾기·만들기만 잠근다 */
    private final Object[] locks = new Object[64];

    public AnalysisService(AnalysisResultService resultService, AnalysisRepository analysisRepository,
            ComparabilityService comparabilityService, AnalysisRunner runner, ReportService reportService,
            Clock clock) {
        this.resultService = resultService;
        this.analysisRepository = analysisRepository;
        this.comparabilityService = comparabilityService;
        this.runner = runner;
        this.reportService = reportService;
        this.clock = clock;
        for (int i = 0; i < locks.length; i++) {
            locks[i] = new Object();
        }
    }

    public RequestResult request(String corpCode, String currentRceptNo, String previousRceptNo,
            ComparisonBasis requestedBasis) {
        ComparisonBasis basis = effectiveBasis(requestedBasis, currentRceptNo, previousRceptNo);
        Object lock = locks[Math.floorMod(String.join("|", corpCode, currentRceptNo, previousRceptNo,
                basis.name()).hashCode(), locks.length)];

        Optional<RequestResult> reused = reuse(lock, corpCode, currentRceptNo, previousRceptNo, basis);
        if (reused.isPresent()) {
            return reused.get();
        }
        // 비교 가능성 검증은 OpenDART를 부를 수 있어 잠금 밖에서 한다
        ComparabilityResult check = comparabilityService.check(corpCode, currentRceptNo, previousRceptNo, basis);
        if (!check.comparable()) {
            String reason = check.reasons().isEmpty() ? ErrorCode.ANALYSIS_NOT_COMPARABLE.defaultMessage()
                    : check.reasons().getFirst().message();
            throw new ApiException(ErrorCode.ANALYSIS_NOT_COMPARABLE, reason);
        }
        Analysis created;
        synchronized (lock) {
            // 검증하는 동안 같은 요청이 먼저 만들었으면 그것을 쓴다
            reused = reuse(lock, corpCode, currentRceptNo, previousRceptNo, basis);
            if (reused.isPresent()) {
                return reused.get();
            }
            LocalDateTime now = LocalDateTime.now(clock).truncatedTo(ChronoUnit.MICROS);
            Analysis analysis = Analysis.request(corpCode, currentRceptNo, previousRceptNo, basis,
                    TraceContext.currentTraceId(), now);
            analysis.recordFsDiv(check.fsDiv());
            created = analysisRepository.save(analysis);
        }
        runner.submit(created.getId());
        return new RequestResult(analysisRepository.findById(created.getId()).orElse(created), false, false);
    }

    private Optional<RequestResult> reuse(Object lock, String corpCode, String currentRceptNo,
            String previousRceptNo, ComparisonBasis basis) {
        synchronized (lock) {
            return resultService.findReusable(corpCode, currentRceptNo, previousRceptNo, basis)
                    .map(a -> new RequestResult(a, a.getStatus() == AnalysisStatus.COMPLETED, true));
        }
    }

    /**
     * 고른 보고서 쌍이 실제로 맞는 비교 기준으로 저장한다. 전년 동기·직전 기간으로 요청했는데 맞지 않으면 직접 선택으로,
     * 직접 선택으로 요청했는데 전년 동기·직전 기간 쌍이면 그 기준으로 바꾼다.
     * 결과 화면이 기준을 잘못 보여 주지 않고, 같은 보고서 쌍이 기준 이름만 달리 두 번 분석되지 않게 하기 위해서다.
     */
    private ComparisonBasis effectiveBasis(ComparisonBasis basis, String currentRceptNo, String previousRceptNo) {
        Report current = reportService.get(currentRceptNo).report();
        Report previous = reportService.get(previousRceptNo).report();
        if (basis != ComparisonBasis.CUSTOM) {
            return ReportPairService.matchesBasis(basis, current, previous) ? basis : ComparisonBasis.CUSTOM;
        }
        for (ComparisonBasis named : List.of(ComparisonBasis.YOY, ComparisonBasis.PREV)) {
            if (ReportPairService.matchesBasis(named, current, previous)) {
                return named;
            }
        }
        return ComparisonBasis.CUSTOM;
    }

    /**
     * @param completed 완료된 결과를 다시 쓴 경우(200)
     * @param reused    새로 만들지 않고 기존 분석을 돌려준 경우
     */
    public record RequestResult(Analysis analysis, boolean completed, boolean reused) {
    }
}
