package com.dartinsight.analysis;

import com.dartinsight.common.error.ApiException;
import com.dartinsight.common.error.ErrorCode;
import com.dartinsight.common.trace.TraceContext;
import com.dartinsight.comparison.ComparabilityService;
import com.dartinsight.comparison.ComparabilityService.ComparabilityResult;
import com.dartinsight.comparison.ComparisonBasis;
import java.time.Clock;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.Optional;
import org.springframework.stereotype.Service;

/**
 * 분석 요청(2.3).
 * <ul>
 *   <li>같은 조건으로 완료된 결과가 있으면 새로 만들지 않고 돌려준다(reused).</li>
 *   <li>진행 중인 분석이 있으면 그 분석을 돌려준다(중복 수집·분석을 막음).</li>
 *   <li>비교 가능성 검증(2.2)을 통과하지 못하면 만들지 않고 422.</li>
 * </ul>
 */
@Service
public class AnalysisService {

    private final AnalysisResultService resultService;
    private final AnalysisRepository analysisRepository;
    private final ComparabilityService comparabilityService;
    private final AnalysisRunner runner;
    private final Clock clock;
    /** 같은 조건의 요청이 동시에 와도 분석을 하나만 만들도록 조건별로 잠근다(서버 한 대 기준) */
    private final Object[] locks = new Object[64];

    public AnalysisService(AnalysisResultService resultService, AnalysisRepository analysisRepository,
            ComparabilityService comparabilityService, AnalysisRunner runner, Clock clock) {
        this.resultService = resultService;
        this.analysisRepository = analysisRepository;
        this.comparabilityService = comparabilityService;
        this.runner = runner;
        this.clock = clock;
        for (int i = 0; i < locks.length; i++) {
            locks[i] = new Object();
        }
    }

    public RequestResult request(String corpCode, String currentRceptNo, String previousRceptNo,
            ComparisonBasis basis) {
        String key = String.join("|", corpCode, currentRceptNo, previousRceptNo, basis.name());
        Analysis created;
        synchronized (locks[Math.floorMod(key.hashCode(), locks.length)]) {
            Optional<Analysis> existing = resultService.findReusable(corpCode, currentRceptNo, previousRceptNo, basis);
            if (existing.isPresent()) {
                return new RequestResult(existing.get(), existing.get().getStatus() == AnalysisStatus.COMPLETED,
                        true);
            }
            ComparabilityResult check = comparabilityService.check(corpCode, currentRceptNo, previousRceptNo, basis);
            if (!check.comparable()) {
                String reason = check.reasons().isEmpty() ? ErrorCode.ANALYSIS_NOT_COMPARABLE.defaultMessage()
                        : check.reasons().getFirst().message();
                throw new ApiException(ErrorCode.ANALYSIS_NOT_COMPARABLE, reason);
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

    /**
     * @param completed 완료된 결과를 다시 쓴 경우(200)
     * @param reused    새로 만들지 않고 기존 분석을 돌려준 경우
     */
    public record RequestResult(Analysis analysis, boolean completed, boolean reused) {
    }
}
