package com.dartinsight.briefing.service;

import com.dartinsight.aiserver.client.AiServerClient;
import com.dartinsight.aiserver.client.AiServerException;
import com.dartinsight.aiserver.client.AiServerPaths;
import com.dartinsight.analysis.service.TextEvidenceService;
import com.dartinsight.briefing.domain.BriefingRecord;
import com.dartinsight.briefing.domain.BriefingSources;
import com.dartinsight.briefing.domain.BriefingSource;
import com.dartinsight.briefing.domain.BriefingUnavailableReason;
import com.dartinsight.briefing.dto.BriefingAiResponse;
import com.dartinsight.briefing.dto.CompanyBriefingResponse;
import com.dartinsight.briefing.repository.BriefingStore;
import com.dartinsight.common.trace.TraceContext;
import com.dartinsight.document.domain.DocumentSection;
import com.dartinsight.document.domain.ReportDocument;
import com.dartinsight.document.service.DocumentService;
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
 * AI 기업 브리핑(1.2, FS-49, ADR-0025). 동기 호출이다.
 * <ol>
 *   <li>정기보고서 목록에서 가장 최근 사업보고서(없으면 가장 최근 정기보고서)를 고른다</li>
 *   <li>그 보고서·{@link #PROMPT_VERSION}으로 저장한 브리핑이 있으면 그대로 돌려준다(다시 만들지 않음)</li>
 *   <li>없으면 원문을 준비하고({@link DocumentService#ensureStructured}) 근거를 골라({@link BriefingSources})
 *       AI 서버에 묻는다. 결과(GENERATED·REVIEW_NEEDED)와 LLM 호출 기록을 한 트랜잭션으로 저장한다</li>
 * </ol>
 * 자료가 없으면(NOT_AVAILABLE) 저장하지 않는다. 외부 호출은 트랜잭션 밖에서 한다(LY-2).
 */
@Service
@RequiredArgsConstructor
public class BriefingService {

    /** ai-server app/briefing/prompt.py PROMPT_VERSION과 같아야 한다. 근거 고르기 규칙을 바꿔도 올린다 */
    public static final String PROMPT_VERSION = "briefing-1";

    private static final Logger log = LoggerFactory.getLogger(BriefingService.class);
    private static final Object[] LOCKS = new Object[64];

    static {
        for (int i = 0; i < LOCKS.length; i++) {
            LOCKS[i] = new Object();
        }
    }

    private final ReportService reportService;
    private final DocumentService documentService;
    private final AiServerClient aiServerClient;
    private final BriefingStore store;
    private final TransactionTemplate transactionTemplate;
    private final Clock clock;

    /**
     * 기업 브리핑. 없는 기업이면 404 COMPANY_NOT_FOUND.
     *
     * @throws com.dartinsight.common.error.ApiException OpenDART 호출 실패(DART_*)
     * @throws AiServerException                          AI 서버·LLM을 쓸 수 없음(503 AI_SERVER_UNAVAILABLE)
     */
    public CompanyBriefingResponse get(String corpCode) {
        ReportList list = reportService.list(corpCode);
        Optional<Report> source = sourceReport(list.reports());
        if (source.isEmpty()) {
            return CompanyBriefingResponse.notAvailable(corpCode, null, BriefingUnavailableReason.NO_REPORT);
        }
        Report report = source.get();
        String rceptNo = report.getRceptNo();
        synchronized (LOCKS[Math.floorMod(rceptNo.hashCode(), LOCKS.length)]) {
            Optional<BriefingRecord> saved = store.find(rceptNo, PROMPT_VERSION);
            if (saved.isPresent()) {
                return CompanyBriefingResponse.of(corpCode, report, saved.get());
            }
            ReportDocument document = documentService.ensureStructured(report);
            if (!document.getStatus().usable()) {
                return CompanyBriefingResponse.notAvailable(corpCode, report, BriefingUnavailableReason.NO_DOCUMENT);
            }
            List<DocumentSection> sections = documentService.sections(document);
            List<BriefingSource> sources = BriefingSources.select(sections, documentService.blocks(document),
                    TextEvidenceService.paths(sections));
            if (sources.isEmpty()) {
                return CompanyBriefingResponse.notAvailable(corpCode, report, BriefingUnavailableReason.NO_SOURCE);
            }
            return CompanyBriefingResponse.of(corpCode, report,
                    generate(list.company().getCorpName(), report, sources));
        }
    }

    /** 대상 기간이 가장 최근인 사업보고서, 없으면 가장 최근 정기보고서. 목록은 대상 기간이 최근인 순서다. 기업 질문(ADR-0029)도 쓴다 */
    public static Optional<Report> sourceReport(List<Report> reports) {
        return reports.stream().filter(r -> r.getReportType() == ReportType.ANNUAL).findFirst()
                .or(() -> reports.stream().findFirst());
    }

    private BriefingRecord generate(String companyName, Report report, List<BriefingSource> sources) {
        String traceId = TraceContext.currentTraceId();
        BriefingAiResponse response = BriefingResults.requireStatus(aiServerClient.postJson(AiServerPaths.BRIEFINGS,
                BriefingResults.request(PROMPT_VERSION, companyName, report.getReportName(), sources),
                BriefingAiResponse.class));
        if (!PROMPT_VERSION.equals(response.promptVersion())) {
            log.warn("AI 서버 브리핑 프롬프트 버전이 다릅니다: {}", response.promptVersion());
        }
        List<LlmCallRow> calls = BriefingResults.calls(response, traceId);
        BriefingRecord row = BriefingResults.interpret(report.getRceptNo(), PROMPT_VERSION, response, sources,
                traceId, now());
        try {
            Long id = transactionTemplate.execute(status -> store.save(row, calls));
            log.info("브리핑 저장 {}: {} 문장 {}개", report.getRceptNo(), row.status(), row.sentences().size());
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
