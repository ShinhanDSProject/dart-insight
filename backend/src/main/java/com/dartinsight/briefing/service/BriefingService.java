package com.dartinsight.briefing.service;

import com.dartinsight.aiserver.client.AiServerClient;
import com.dartinsight.aiserver.client.AiServerException;
import com.dartinsight.aiserver.client.AiServerPaths;
import com.dartinsight.analysis.service.TextEvidenceService;
import com.dartinsight.briefing.domain.BriefingRecord;
import com.dartinsight.briefing.domain.BriefingSentence;
import com.dartinsight.briefing.domain.BriefingSource;
import com.dartinsight.briefing.domain.BriefingStatus;
import com.dartinsight.briefing.domain.BriefingUnavailableReason;
import com.dartinsight.briefing.dto.BriefingAiRequest;
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
import java.time.format.DateTimeParseException;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;
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
    static final String TASK = "briefing";
    static final int QUOTE_CHARS = 600;
    static final String BAD_EVIDENCE = "브리핑 문장의 근거가 보낸 원문 위치가 아니라 쓰지 않았어요.";
    static final String NOT_VERIFIED = "근거를 확인하지 못해 브리핑을 보여 주지 않아요.";

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

    /** 대상 기간이 가장 최근인 사업보고서, 없으면 가장 최근 정기보고서. 목록은 대상 기간이 최근인 순서다 */
    static Optional<Report> sourceReport(List<Report> reports) {
        return reports.stream().filter(r -> r.getReportType() == ReportType.ANNUAL).findFirst()
                .or(() -> reports.stream().findFirst());
    }

    private BriefingRecord generate(String companyName, Report report, List<BriefingSource> sources) {
        String traceId = TraceContext.currentTraceId();
        BriefingAiResponse response = aiServerClient.postJson(AiServerPaths.BRIEFINGS, new BriefingAiRequest(
                PROMPT_VERSION, companyName, report.getReportName(), sources.stream()
                        .map(s -> new BriefingAiRequest.Source(s.evidenceId(), s.topic().name(), s.sectionPath(),
                                s.text()))
                        .toList()), BriefingAiResponse.class);
        if (response == null || response.status() == null) {
            throw new AiServerException(null, "AI 서버 브리핑 응답이 비어 있어요.", null);
        }
        if (!PROMPT_VERSION.equals(response.promptVersion())) {
            log.warn("AI 서버 브리핑 프롬프트 버전이 다릅니다: {}", response.promptVersion());
        }
        List<LlmCallRow> calls = response.calls() == null ? List.of()
                : response.calls().stream().map(c -> call(c, traceId)).toList();
        BriefingRecord row = interpret(report.getRceptNo(), response, sources, traceId);
        try {
            Long id = transactionTemplate.execute(status -> store.save(row, calls));
            log.info("브리핑 저장 {}: {} 문장 {}개", report.getRceptNo(), row.status(), row.sentences().size());
            return row.withId(id);
        } catch (DataIntegrityViolationException e) {
            // 같은 보고서를 동시에 만든 경우에만 저장된 것을 쓴다
            return store.find(report.getRceptNo(), PROMPT_VERSION).orElseThrow(() -> e);
        }
    }

    /** AI 서버 결과를 저장할 기록으로 바꾼다. 문장의 근거가 보낸 블록인지 여기서 다시 확인한다 */
    private BriefingRecord interpret(String rceptNo, BriefingAiResponse response, List<BriefingSource> sources,
            String traceId) {
        LocalDateTime generatedAt = time(response.generatedAt());
        List<String> blocked = response.blockedRules() == null ? List.of() : response.blockedRules();
        Map<String, BriefingSource> byEvidence = sources.stream()
                .collect(Collectors.toMap(BriefingSource::evidenceId, Function.identity(), (a, b) -> a));
        BriefingStatus status = BriefingStatus.GENERATED.name().equals(response.status()) ? BriefingStatus.GENERATED
                : BriefingStatus.REVIEW_NEEDED;
        String reason = response.reviewReason();
        List<BriefingSentence> sentences = new ArrayList<>();
        if (status == BriefingStatus.GENERATED) {
            List<BriefingAiResponse.Sentence> items = response.sentences() == null ? List.of() : response.sentences();
            for (BriefingAiResponse.Sentence item : items) {
                Optional<BriefingSentence> sentence = sentence(item, byEvidence);
                if (sentence.isEmpty()) {
                    sentences.clear();
                    break;
                }
                sentences.add(sentence.get());
            }
            if (sentences.isEmpty()) {
                log.warn("AI 서버 브리핑의 근거를 확인하지 못해 검토 필요로 둡니다");
                status = BriefingStatus.REVIEW_NEEDED;
                reason = BAD_EVIDENCE;
            }
        } else if (!BriefingStatus.REVIEW_NEEDED.name().equals(response.status())) {
            log.warn("AI 서버 브리핑 상태를 알 수 없어 검토 필요로 둡니다: {}", response.status());
            reason = NOT_VERIFIED;
        }
        return new BriefingRecord(null, rceptNo, PROMPT_VERSION, status, sentences,
                status == BriefingStatus.GENERATED ? null : reason == null ? NOT_VERIFIED : reason, blocked,
                response.model(), generatedAt, traceId, now());
    }

    private static Optional<BriefingSentence> sentence(BriefingAiResponse.Sentence item,
            Map<String, BriefingSource> byEvidence) {
        if (item == null || item.text() == null || item.text().isBlank() || item.evidenceIds() == null
                || item.evidenceIds().isEmpty()) {
            return Optional.empty();
        }
        List<BriefingSentence.Evidence> evidence = new ArrayList<>();
        for (String evidenceId : item.evidenceIds().stream().distinct().toList()) {
            BriefingSource source = byEvidence.get(evidenceId);
            if (source == null) {
                return Optional.empty();
            }
            String text = source.text();
            evidence.add(new BriefingSentence.Evidence(evidenceId, source.sectionNo(), source.blockNo(),
                    source.sectionPath(), text.length() <= QUOTE_CHARS ? text : text.substring(0, QUOTE_CHARS)));
        }
        return Optional.of(new BriefingSentence(item.text().strip(), evidence));
    }

    private static LlmCallRow call(BriefingAiResponse.Call call, String traceId) {
        return new LlmCallRow(call.task() == null ? TASK : call.task(), call.provider(), call.model(),
                call.promptVersion(), time(call.calledAt()), call.traceId() == null ? traceId : call.traceId(),
                call.inputTokens(), call.outputTokens(), call.latencyMs() == null ? 0 : call.latencyMs(),
                call.attempt() == null ? 1 : call.attempt(), call.outcome(), call.error());
    }

    private static LocalDateTime time(String value) {
        try {
            return value == null ? null : LocalDateTime.parse(value);
        } catch (DateTimeParseException e) {
            return null;
        }
    }

    private LocalDateTime now() {
        return LocalDateTime.now(clock).truncatedTo(ChronoUnit.MICROS);
    }
}
