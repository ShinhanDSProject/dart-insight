package com.dartinsight.outlook.service;

import com.dartinsight.aiserver.client.AiServerClient;
import com.dartinsight.aiserver.client.AiServerException;
import com.dartinsight.aiserver.client.AiServerPaths;
import com.dartinsight.analysis.service.TextEvidenceService;
import com.dartinsight.common.trace.TraceContext;
import com.dartinsight.document.domain.DocumentSection;
import com.dartinsight.document.domain.ReportDocument;
import com.dartinsight.document.service.DocumentService;
import com.dartinsight.outlook.domain.OutlookRecord;
import com.dartinsight.outlook.domain.OutlookSource;
import com.dartinsight.outlook.domain.OutlookSources;
import com.dartinsight.outlook.domain.OutlookUnavailableReason;
import com.dartinsight.outlook.domain.ReportOutlook;
import com.dartinsight.outlook.dto.CompanyOutlookResponse;
import com.dartinsight.outlook.dto.OutlookAiRequest;
import com.dartinsight.outlook.dto.OutlookAiResponse;
import com.dartinsight.outlook.repository.OutlookStore;
import com.dartinsight.report.domain.Report;
import com.dartinsight.report.domain.ReportType;
import com.dartinsight.report.service.ReportService;
import com.dartinsight.report.service.ReportService.ReportList;
import com.dartinsight.summary.domain.LlmCallRow;
import java.time.Clock;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * 회사가 밝힌 전망·계획(1.9, FS-59, ADR-0039). 동기 호출이다.
 * <ol>
 *   <li>정기보고서 목록에서 가장 최근 사업보고서를 고른다(없으면 NOT_AVAILABLE, 다른 정기보고서로 대신하지 않음)</li>
 *   <li>그 보고서·{@link #PROMPT_VERSION}으로 저장한 결과가 있으면 그대로 돌려준다(다시 만들지 않음)</li>
 *   <li>없으면 원문을 준비하고({@link DocumentService#ensureStructured}) 근거를 골라({@link OutlookSources})
 *       AI 서버에 묻는다. 결과(GENERATED·EMPTY·REVIEW_NEEDED)와 LLM 호출 기록을 한 트랜잭션으로 저장한다</li>
 * </ol>
 * 자료가 없거나(NOT_AVAILABLE) 계획 낱말 문단이 없어 AI를 부르지 않은 EMPTY는 저장하지 않는다.
 * 외부 호출은 트랜잭션 밖에서 한다(LY-2).
 */
@Service
@RequiredArgsConstructor
public class OutlookService {

    /** ai-server app/outlook/prompt.py PROMPT_VERSION과 같아야 한다. 근거 고르기 규칙을 바꿔도 올린다 */
    public static final String PROMPT_VERSION = "outlook-1";

    private static final Logger log = LoggerFactory.getLogger(OutlookService.class);
    private static final Object[] LOCKS = new Object[64];

    static {
        for (int i = 0; i < LOCKS.length; i++) {
            LOCKS[i] = new Object();
        }
    }

    private final ReportService reportService;
    private final DocumentService documentService;
    private final AiServerClient aiServerClient;
    private final OutlookStore store;
    private final TransactionTemplate transactionTemplate;
    private final Clock clock;

    /**
     * 기업 화면의 전망·계획(최신 사업보고서). 없는 기업이면 404 COMPANY_NOT_FOUND.
     *
     * @throws com.dartinsight.common.error.ApiException OpenDART 호출 실패(DART_*)
     * @throws AiServerException                          AI 서버·LLM을 쓸 수 없음(503 AI_SERVER_UNAVAILABLE)
     */
    public CompanyOutlookResponse get(String corpCode) {
        ReportList list = reportService.list(corpCode);
        Optional<Report> annual = latestAnnual(list.reports());
        if (annual.isEmpty()) {
            return CompanyOutlookResponse.of(corpCode,
                    ReportOutlook.notAvailable(null, OutlookUnavailableReason.NO_REPORT));
        }
        return CompanyOutlookResponse.of(corpCode, outlook(annual.get(), list.company().getCorpName()));
    }

    /**
     * 저장된 보고서 하나의 전망·계획. 저장된 것이 있으면 그대로, 없으면 만들어 저장한다(FS-60이 이전 사업보고서에 쓴다).
     * 보고서 종류는 거르지 않는다. 부르는 쪽이 사업보고서를 넘긴다.
     *
     * @throws com.dartinsight.common.error.ApiException 저장되지 않은 접수번호(404 REPORT_NOT_FOUND), OpenDART 실패
     * @throws AiServerException                          AI 서버·LLM을 쓸 수 없음
     */
    public ReportOutlook forReport(String rceptNo) {
        Report report = reportService.report(rceptNo);
        return outlook(report, report.getFilerName() == null ? "" : report.getFilerName());
    }

    /** 대상 기간이 가장 최근인 사업보고서. 목록은 대상 기간이 최근인 순서다 */
    private static Optional<Report> latestAnnual(List<Report> reports) {
        return reports.stream().filter(r -> r.getReportType() == ReportType.ANNUAL).findFirst();
    }

    private ReportOutlook outlook(Report report, String companyName) {
        String rceptNo = report.getRceptNo();
        synchronized (LOCKS[Math.floorMod(rceptNo.hashCode(), LOCKS.length)]) {
            Optional<OutlookRecord> saved = store.find(rceptNo, PROMPT_VERSION);
            if (saved.isPresent()) {
                return ReportOutlook.of(report, saved.get());
            }
            ReportDocument document = documentService.ensureStructured(report);
            if (!document.getStatus().usable()) {
                return ReportOutlook.notAvailable(report, OutlookUnavailableReason.NO_DOCUMENT);
            }
            List<DocumentSection> sections = documentService.sections(document);
            List<OutlookSource> sources = OutlookSources.select(sections, documentService.blocks(document),
                    TextEvidenceService.paths(sections));
            if (sources.isEmpty()) {
                return ReportOutlook.notAvailable(report, OutlookUnavailableReason.NO_SOURCE);
            }
            if (!OutlookSources.anyPlanned(sources)) {
                return ReportOutlook.noPlan(report);
            }
            return ReportOutlook.of(report, generate(companyName, report, sources));
        }
    }

    private OutlookRecord generate(String companyName, Report report, List<OutlookSource> sources) {
        String traceId = TraceContext.currentTraceId();
        OutlookAiResponse response = OutlookResults.requireStatus(aiServerClient.postJson(AiServerPaths.OUTLOOKS,
                OutlookAiRequest.of(PROMPT_VERSION, companyName, report.getReportName(), sources),
                OutlookAiResponse.class));
        if (!PROMPT_VERSION.equals(response.promptVersion())) {
            log.warn("AI 서버 전망·계획 프롬프트 버전이 다릅니다: {}", response.promptVersion());
        }
        List<LlmCallRow> calls = OutlookResults.calls(response, traceId);
        OutlookRecord row = OutlookResults.interpret(report.getRceptNo(), PROMPT_VERSION, response, sources,
                traceId, now());
        try {
            Long id = transactionTemplate.execute(status -> store.save(row, calls));
            log.info("전망·계획 저장 {}: {} 항목 {}개", report.getRceptNo(), row.status(), row.items().size());
            return row.withId(id);
        } catch (DataIntegrityViolationException e) {
            // 같은 보고서를 동시에 만든 경우에만 저장된 것을 쓴다
            return store.find(report.getRceptNo(), PROMPT_VERSION).orElseThrow(() -> e);
        }
    }

    private LocalDateTime now() {
        return LocalDateTime.now(clock).truncatedTo(ChronoUnit.MICROS);
    }
}
