package com.dartinsight.activity.service;

import com.dartinsight.activity.domain.ActivityPayload.Evidence;
import com.dartinsight.activity.domain.ActivityRecord;
import com.dartinsight.activity.domain.PeriodDisclosure;
import com.dartinsight.activity.dto.ActivityAiRequest;
import com.dartinsight.activity.dto.ActivityAiResponse;
import com.dartinsight.activity.dto.PeriodActivityResponse;
import com.dartinsight.activity.repository.ActivityStore;
import com.dartinsight.aiserver.client.AiServerClient;
import com.dartinsight.aiserver.client.AiServerException;
import com.dartinsight.analysis.domain.Analysis;
import com.dartinsight.analysis.domain.FinancialChange;
import com.dartinsight.analysis.domain.TextChange;
import com.dartinsight.analysis.service.FinancialChangeQueryService;
import com.dartinsight.analysis.service.TextChangeQueryService;
import com.dartinsight.analysis.service.TextChangeQueryService.CompletedTextChanges;
import com.dartinsight.common.trace.TraceContext;
import com.dartinsight.document.service.DocumentService;
import com.dartinsight.report.domain.Report;
import com.dartinsight.report.service.ReportService;
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
 * 두 보고서 사이에 회사가 한 일과 앞으로의 영향(ADR-0067). 동기 호출이다(ADR-0039와 같은 방식).
 * <ol>
 *   <li>완료된 분석과 그 문장 변경을 읽는다(없으면 404, 끝나지 않았으면 409). 문장 비교 결과가 없으면 NOT_AVAILABLE</li>
 *   <li>그 분석·{@link #PROMPT_VERSION}으로 저장한 결과가 있으면 그대로 돌려준다(다시 만들지 않음)</li>
 *   <li>없으면 후보가 될 수 있는 변경과 재무 수치·사이 기간 공시(ADR-0068)를 AI 서버에 보내고, 근거 위치를 다시 확인해 결과와
 *   LLM 호출 기록을 한 트랜잭션으로 저장한다</li>
 * </ol>
 * 후보가 없어 AI를 부르지 않은 EMPTY는 저장하지 않는다. 외부 호출은 트랜잭션 밖에서 한다(LY-2).
 */
@Service
@RequiredArgsConstructor
public class PeriodActivityService {

    /** ai-server app/activity/prompt.py PROMPT_VERSION과 같아야 한다. 보내는 변경의 규칙을 바꿔도 올린다 */
    public static final String PROMPT_VERSION = "period-activity-2";

    /** ai-server app/activity/model.py DISCLOSURE_TEXT_LIMIT와 같다 */
    private static final int DISCLOSURE_TEXT_LIMIT = 1500;
    private static final Logger log = LoggerFactory.getLogger(PeriodActivityService.class);
    private static final Object[] LOCKS = new Object[64];

    static {
        for (int i = 0; i < LOCKS.length; i++) {
            LOCKS[i] = new Object();
        }
    }

    private final TextChangeQueryService textChangeQueryService;
    private final FinancialChangeQueryService financialChangeQueryService;
    private final ReportService reportService;
    private final PeriodDisclosureLoader disclosureLoader;
    private final DocumentService documentService;
    private final AiServerClient aiServerClient;
    private final ActivityStore store;
    private final TransactionTemplate transactionTemplate;
    private final Clock clock;

    /**
     * @throws com.dartinsight.common.error.ApiException 없는 분석(404 ANALYSIS_NOT_FOUND), 끝나지 않은 분석(409 ANALYSIS_NOT_READY)
     * @throws AiServerException                          AI 서버·LLM을 쓸 수 없음(503 AI_SERVER_UNAVAILABLE)
     */
    public PeriodActivityResponse get(Long analysisId) {
        CompletedTextChanges completed = textChangeQueryService.completedChanges(analysisId);
        Analysis analysis = completed.analysis();
        if (!analysis.hasTextResult()) {
            return PeriodActivityResponse.textNotCompared(analysisId);
        }
        synchronized (LOCKS[Math.floorMod(analysisId.hashCode(), LOCKS.length)]) {
            Optional<ActivityRecord> saved = store.find(analysisId, PROMPT_VERSION);
            if (saved.isPresent()) {
                return PeriodActivityResponse.of(saved.get());
            }
            List<TextChange> sent = ActivityRequests.sent(completed.changes());
            if (sent.isEmpty()) {
                return PeriodActivityResponse.noCandidates(analysisId);
            }
            return generate(analysis, sent);
        }
    }

    private PeriodActivityResponse generate(Analysis analysis, List<TextChange> sent) {
        Report previous = reportService.report(analysis.getPreviousRceptNo());
        Report current = reportService.report(analysis.getCurrentRceptNo());
        String companyName = current.getFilerName() == null ? analysis.getCorpCode() : current.getFilerName();
        List<FinancialChange> financials = ActivityRequests.financials(
                financialChangeQueryService.changes(analysis.getId()).changes());
        List<PeriodDisclosure> disclosures = disclosureLoader.load(analysis.getCorpCode(),
                previous.getRceptDt().plusDays(1), current.getRceptDt());
        ActivityAiRequest request = ActivityRequests.of(PROMPT_VERSION, companyName, previous, current, sent,
                financials, disclosures.stream().map(this::withText).toList());
        String traceId = TraceContext.currentTraceId();
        ActivityAiResponse response = ActivityResults.requireStatus(
                aiServerClient.postPeriodActivities(request, ActivityAiResponse.class));
        if (!PROMPT_VERSION.equals(response.promptVersion())) {
            log.warn("AI 서버 활동 프롬프트 버전이 다릅니다: {}", response.promptVersion());
        }
        if (ActivityResults.notCalled(response)) {
            return PeriodActivityResponse.noCandidates(analysis.getId());
        }
        Map<String, Evidence> evidence = ActivityRequests.evidence(sent, financials, disclosures);
        ActivityRecord row = ActivityResults.interpret(analysis.getId(), PROMPT_VERSION, response, evidence,
                traceId, now());
        List<LlmCallRow> calls = ActivityResults.calls(response, traceId);
        try {
            Long id = transactionTemplate.execute(status -> store.save(row, calls));
            log.info("활동·영향 저장 분석 {}: {} 카드 {}개 뺌 {}", analysis.getId(), row.status(),
                    row.payload().items().size(), row.payload().droppedCount());
            return PeriodActivityResponse.of(row.withId(id));
        } catch (DataIntegrityViolationException e) {
            // 같은 분석을 동시에 만든 경우에만 저장된 것을 쓴다
            return PeriodActivityResponse.of(store.find(analysis.getId(), PROMPT_VERSION).orElseThrow(() -> e));
        }
    }

    private ActivityAiRequest.Disclosure withText(PeriodDisclosure disclosure) {
        String text = documentService.disclosureText(disclosure.rceptNo(), DISCLOSURE_TEXT_LIMIT).orElse("");
        return new ActivityAiRequest.Disclosure(disclosure.evidenceId(), disclosure.rceptDt().toString(),
                disclosure.reportName(), text);
    }

    private LocalDateTime now() {
        return LocalDateTime.now(clock).truncatedTo(ChronoUnit.MICROS);
    }
}
