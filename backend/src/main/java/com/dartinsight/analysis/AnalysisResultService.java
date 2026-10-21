package com.dartinsight.analysis;

import com.dartinsight.common.error.ApiException;
import com.dartinsight.common.error.ErrorCode;
import com.dartinsight.comparison.ComparisonBasis;
import java.time.Clock;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 분석 결과 저장·조회(4.3).
 * <ul>
 *   <li>결과는 기업·현재 보고서·이전 보고서·비교 기준·분석 버전으로 식별한다.</li>
 *   <li>같은 조건으로 완료된 분석이 있으면 다시 쓰고, 진행 중이면 그 분석을 돌려준다. 실패한 분석은 다시 쓰지 않는다.</li>
 *   <li>정정 공시는 접수번호가 달라 새 분석이 된다. 기존 결과를 덮어쓰지 않는다.</li>
 *   <li>결과 저장과 완료 표시는 한 트랜잭션이다. 저장이 실패하면 완료로 바뀌지 않는다.</li>
 * </ul>
 */
@Service
public class AnalysisResultService {

    private final AnalysisRepository analysisRepository;
    private final FinancialChangeRepository changeRepository;
    private final Clock clock;

    public AnalysisResultService(AnalysisRepository analysisRepository, FinancialChangeRepository changeRepository,
            Clock clock) {
        this.analysisRepository = analysisRepository;
        this.changeRepository = changeRepository;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public Optional<Analysis> findReusable(String corpCode, String currentRceptNo, String previousRceptNo,
            ComparisonBasis basis) {
        List<Analysis> same = analysisRepository
                .findByCorpCodeAndCurrentRceptNoAndPreviousRceptNoAndBasisAndAnalysisVersionOrderByIdDesc(corpCode,
                        currentRceptNo, previousRceptNo, basis, Analysis.CURRENT_VERSION);
        return same.stream().filter(a -> a.getStatus() == AnalysisStatus.COMPLETED).findFirst()
                .or(() -> same.stream().filter(a -> !a.getStatus().finished()).findFirst());
    }

    /**
     * 결과를 저장하고 같은 트랜잭션에서 완료로 바꾼다. 저장하다 실패하면 트랜잭션이 되돌아가 완료가 되지 않는다.
     */
    @Transactional
    public void saveAndComplete(Long analysisId, List<FinancialChangeRow> rows) {
        Analysis analysis = get(analysisId);
        changeRepository.saveAll(rows.stream().map(row -> FinancialChange.of(analysisId, row)).toList());
        changeRepository.flush();
        analysis.complete(now());
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

    public record CompletedResult(Analysis analysis, List<FinancialChange> changes) {
    }

    private LocalDateTime now() {
        return LocalDateTime.now(clock).truncatedTo(ChronoUnit.MICROS);
    }
}
