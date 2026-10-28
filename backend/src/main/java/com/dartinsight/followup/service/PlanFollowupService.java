package com.dartinsight.followup.service;

import com.dartinsight.aiserver.client.AiServerClient;
import com.dartinsight.aiserver.client.AiServerException;
import com.dartinsight.aiserver.client.AiServerPaths;
import com.dartinsight.analysis.service.TextEvidenceService;
import com.dartinsight.common.trace.TraceContext;
import com.dartinsight.document.domain.ReportDocument;
import com.dartinsight.document.service.DocumentService;
import com.dartinsight.followup.domain.AnnualReportPair;
import com.dartinsight.followup.domain.CompanyPlan;
import com.dartinsight.followup.domain.PlanCandidate;
import com.dartinsight.followup.domain.PlanCandidates;
import com.dartinsight.followup.domain.PlanFollowupReason;
import com.dartinsight.followup.domain.PlanFollowupRecord;
import com.dartinsight.followup.domain.PlanFollowupResult;
import com.dartinsight.followup.dto.CompanyPlanFollowupResponse;
import com.dartinsight.followup.dto.PlanFollowupAiRequest;
import com.dartinsight.followup.dto.PlanFollowupAiResponse;
import com.dartinsight.followup.repository.PlanFollowupStore;
import com.dartinsight.outlook.domain.ReportOutlook;
import com.dartinsight.outlook.service.OutlookService;
import com.dartinsight.report.domain.Report;
import com.dartinsight.report.service.ReportService;
import com.dartinsight.report.service.ReportService.ReportList;
import com.dartinsight.summary.domain.LlmCallRow;
import java.time.Clock;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * 약속과 실제 대조(1.10, FS-60, ADR-0041). 동기 호출이다.
 * <ol>
 *   <li>가장 최근 사업보고서(올해)와 사업연도가 한 해 앞선 사업보고서(작년)를 고른다({@link AnnualReportPair})</li>
 *   <li>두 보고서·{@link #PROMPT_VERSION}으로 저장한 대조가 있으면 그대로 돌려준다</li>
 *   <li>없으면 작년 전망·계획을 받고({@link OutlookService#forReport}) 회사 행동 계획만 고른 뒤,
 *       올해 원문을 준비해({@link DocumentService#ensureStructured}) 계획마다 후보 문단을 골라({@link PlanCandidates})
 *       AI 서버에 묻는다. 결과와 LLM 호출 기록을 한 트랜잭션으로 저장한다</li>
 * </ol>
 * 대조를 만들지 않은 결과(자료 없음, 계획 없음, 작년 전망 검토 필요)는 저장하지 않는다. 외부 호출은 트랜잭션 밖에서 한다(LY-2).
 */
@Service
@RequiredArgsConstructor
public class PlanFollowupService {

    /**
     * ai-server app/followup/prompt.py PROMPT_VERSION과 같아야 한다. 후보 찾기 규칙이나 계획 종류를 바꿀 때,
     * {@link OutlookService#PROMPT_VERSION}이 바뀔 때도 올린다
     */
    public static final String PROMPT_VERSION = "plan-followup-1";

    private static final Logger log = LoggerFactory.getLogger(PlanFollowupService.class);
    private static final Object[] LOCKS = new Object[64];

    static {
        for (int i = 0; i < LOCKS.length; i++) {
            LOCKS[i] = new Object();
        }
    }

    private final ReportService reportService;
    private final DocumentService documentService;
    private final OutlookService outlookService;
    private final AiServerClient aiServerClient;
    private final PlanFollowupStore store;
    private final TransactionTemplate transactionTemplate;
    private final Clock clock;

    /**
     * 기업 화면의 약속과 실제 대조. 없는 기업이면 404 COMPANY_NOT_FOUND.
     *
     * @throws com.dartinsight.common.error.ApiException OpenDART 호출 실패(DART_*)
     * @throws AiServerException                          AI 서버·LLM을 쓸 수 없음(503 AI_SERVER_UNAVAILABLE)
     */
    public CompanyPlanFollowupResponse get(String corpCode) {
        ReportList list = reportService.list(corpCode);
        AnnualReportPair pair = AnnualReportPair.of(list.reports());
        Optional<PlanFollowupReason> missing = pair.missing();
        if (missing.isPresent()) {
            return CompanyPlanFollowupResponse.of(corpCode,
                    PlanFollowupResult.stopped(pair.previous(), pair.current(), missing.get()));
        }
        return CompanyPlanFollowupResponse.of(corpCode,
                followups(pair.previous(), pair.current(), list.company().getCorpName()));
    }

    private PlanFollowupResult followups(Report previous, Report current, String companyName) {
        String key = previous.getRceptNo() + current.getRceptNo();
        synchronized (LOCKS[Math.floorMod(key.hashCode(), LOCKS.length)]) {
            Optional<PlanFollowupRecord> saved = store.find(previous.getRceptNo(), current.getRceptNo(),
                    PROMPT_VERSION);
            if (saved.isPresent()) {
                return PlanFollowupResult.of(previous, current, saved.get());
            }
            ReportOutlook outlook = outlookService.forReport(previous.getRceptNo());
            Optional<PlanFollowupReason> stop = CompanyPlan.stop(outlook);
            if (stop.isPresent()) {
                return PlanFollowupResult.stopped(previous, current, stop.get());
            }
            ReportDocument document = documentService.ensureStructured(current);
            if (!document.getStatus().usable()) {
                return PlanFollowupResult.stopped(previous, current, PlanFollowupReason.NO_DOCUMENT);
            }
            PlanCandidates index = PlanCandidates.of(documentService.blocks(document),
                    TextEvidenceService.paths(documentService.sections(document)));
            if (index.isEmpty()) {
                return PlanFollowupResult.stopped(previous, current, PlanFollowupReason.NO_CURRENT_SOURCE);
            }
            List<CompanyPlan> plans = CompanyPlan.from(outlook);
            return PlanFollowupResult.of(previous, current,
                    generate(companyName, previous, current, plans, index.forPlans(plans)));
        }
    }

    private PlanFollowupRecord generate(String companyName, Report previous, Report current, List<CompanyPlan> plans,
            Map<Integer, List<PlanCandidate>> candidates) {
        String traceId = TraceContext.currentTraceId();
        PlanFollowupAiResponse response = PlanFollowupResults.requireStatus(aiServerClient.postJson(
                AiServerPaths.PLAN_FOLLOWUPS, PlanFollowupAiRequest.of(PROMPT_VERSION, companyName,
                        previous.getReportName(), current.getReportName(), plans, candidates),
                PlanFollowupAiResponse.class));
        if (!PROMPT_VERSION.equals(response.promptVersion())) {
            log.warn("AI 서버 대조 프롬프트 버전이 다릅니다: {}", response.promptVersion());
        }
        List<LlmCallRow> calls = PlanFollowupResults.calls(response, traceId);
        PlanFollowupRecord row = PlanFollowupResults.interpret(previous.getRceptNo(), current.getRceptNo(),
                PROMPT_VERSION, response, plans, candidates, traceId, now());
        try {
            Long id = transactionTemplate.execute(status -> store.save(row, calls));
            log.info("약속과 실제 대조 저장 {}→{}: {} 계획 {}개", previous.getRceptNo(), current.getRceptNo(),
                    row.status(), row.items().size());
            return row.withId(id);
        } catch (DataIntegrityViolationException e) {
            // 같은 두 보고서를 동시에 만든 경우에만 저장된 것을 쓴다
            return store.find(previous.getRceptNo(), current.getRceptNo(), PROMPT_VERSION).orElseThrow(() -> e);
        }
    }

    private LocalDateTime now() {
        return LocalDateTime.now(clock).truncatedTo(ChronoUnit.MICROS);
    }
}
