package com.dartinsight.summary;

import com.dartinsight.aiserver.AiServerClient;
import com.dartinsight.aiserver.AiServerException;
import com.dartinsight.analysis.FinancialChangeRow;
import com.dartinsight.analysis.TextChangeRow;
import com.dartinsight.analysis.TextChangeRow.Side;
import com.dartinsight.document.DocumentBlock;
import com.dartinsight.document.DocumentSection;
import com.dartinsight.document.DocumentService;
import com.dartinsight.document.ReportDocument;
import java.time.LocalDateTime;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * 근거 기반 요약(3.2). 코드가 요약할 변화를 고르고 사실 문장(수치)을 만들며, AI 서버(LLM)는 문장 변화의 요약과
 * 공시에 적힌 설명만 쓴다. AI 서버가 근거·숫자를 확인해 통과하지 못한 항목은 '검토 필요'로 돌려준다.
 * AI 서버·LLM을 부를 수 없으면 {@link com.dartinsight.aiserver.AiServerException}을 그대로 던진다(분석 실패).
 */
@Service
public class SummaryService {

    private static final Logger log = LoggerFactory.getLogger(SummaryService.class);
    private static final String MISSING = "요약 결과에 이 항목이 없었어요.";
    private static final String BAD_EVIDENCE = "요약 문장의 근거가 보낸 원문 위치가 아니라 쓰지 않았어요.";

    private final AiServerClient aiServerClient;
    private final DocumentService documentService;

    public SummaryService(AiServerClient aiServerClient, DocumentService documentService) {
        this.aiServerClient = aiServerClient;
        this.documentService = documentService;
    }

    public SummaryResult summarize(String companyName, String previousReport, String currentReport,
            String currentRceptNo, List<FinancialChangeRow> financial, List<TextChangeRow> text) {
        List<Integer> financialPicked = SummarySelector.financial(financial);
        List<Integer> textPicked = SummarySelector.text(text);
        if (financialPicked.isEmpty() && textPicked.isEmpty()) {
            return SummaryResult.empty("요약할 변화가 없어요.");
        }

        Optional<ReportDocument> document = documentService.find(currentRceptNo).filter(d -> d.getStatus().usable());
        List<DocumentSection> sections = document.map(documentService::sections).orElse(List.of());
        List<DocumentBlock> blocks = document.map(documentService::blocks).orElse(List.of());

        Map<String, Integer> financialRefs = new HashMap<>();
        List<SummaryAiRequest.FinancialItem> financialItems = new ArrayList<>();
        for (int index : financialPicked) {
            FinancialChangeRow row = financial.get(index);
            String ref = "F" + (index + 1);
            financialRefs.put(ref, index);
            financialItems.add(new SummaryAiRequest.FinancialItem(ref, row.accountName(), row.direction(),
                    SummarySelector.candidates(row.accountName(), sections, blocks)));
        }
        Map<String, Integer> textRefs = new HashMap<>();
        List<SummaryAiRequest.TextItem> textItems = new ArrayList<>();
        for (int index : textPicked) {
            TextChangeRow row = text.get(index);
            String ref = "T" + (index + 1);
            textRefs.put(ref, index);
            textItems.add(new SummaryAiRequest.TextItem(ref, row.changeType(), row.sectionPath(), sources(row)));
        }

        if (textItems.isEmpty() && financialItems.stream().allMatch(i -> i.candidates().isEmpty())) {
            // LLM이 쓸 것이 없으면(문장 변화도 설명 후보도 없음) AI 서버를 부르지 않는다
            List<SummaryItemRow> rows = financialPicked.stream()
                    .map(i -> new SummaryItemRow(SummaryItemRow.FINANCIAL, SummaryItemRow.SHOWN,
                            FinancialFacts.sentence(financial.get(i)), null, "NOT_FOUND", List.of(), i, null, null,
                            null, null, null, List.of()))
                    .toList();
            return new SummaryResult(SummaryStatus.COMPLETED, null, rows, List.of());
        }

        SummaryAiResponse response = aiServerClient.postJson("/internal/summaries", new SummaryAiRequest(
                companyName, previousReport, currentReport, textItems, financialItems), SummaryAiResponse.class);
        if (response == null || response.items() == null) {
            throw new AiServerException(null, "AI 서버 요약 응답이 비어 있어요.", null);
        }
        LocalDateTime generatedAt = time(response.generatedAt());

        // AI 서버도 확인하지만, 저장하기 전에 여기서 다시 본다: 요청한 항목인지, 겹치지 않는지, 근거가 보낸 원문 위치인지
        Map<String, SummaryAiResponse.Item> answers = new LinkedHashMap<>();
        for (SummaryAiResponse.Item item : response.items()) {
            if (item == null || !(textRefs.containsKey(item.ref()) || financialRefs.containsKey(item.ref()))) {
                log.warn("요약 응답에 요청하지 않은 항목이 있어 뺐습니다: {}", item == null ? null : item.ref());
            } else if (answers.putIfAbsent(item.ref(), item) != null) {
                log.warn("요약 응답에 같은 항목이 두 번 있어 처음 것만 씁니다: {}", item.ref());
            }
        }
        List<SummaryItemRow> rows = new ArrayList<>();
        for (SummaryAiRequest.TextItem item : textItems) {
            rows.add(textRow(answers.get(item.ref()), textRefs.get(item.ref()) + 1, ids(item.sources()), response,
                    generatedAt));
        }
        for (SummaryAiRequest.FinancialItem item : financialItems) {
            int index = financialRefs.get(item.ref());
            rows.add(financialRow(answers.get(item.ref()), index, financial.get(index), ids(item.candidates()),
                    response, generatedAt));
        }
        boolean review = rows.stream().anyMatch(r -> SummaryItemRow.REVIEW_NEEDED.equals(r.status())
                || SummaryItemRow.REVIEW_NEEDED.equals(r.explanationStatus()));
        List<LlmCallRow> calls = response.calls() == null ? List.of()
                : response.calls().stream().map(SummaryService::call).toList();
        return new SummaryResult(review ? SummaryStatus.PARTIAL : SummaryStatus.COMPLETED,
                review ? "근거를 확인하지 못한 항목은 요약에서 빼고 '검토 필요'로 남겼어요." : null, rows, calls);
    }

    private static Set<String> ids(List<SummaryAiRequest.Source> sources) {
        Set<String> ids = new HashSet<>();
        sources.forEach(s -> ids.add(s.evidenceId()));
        return ids;
    }

    /** 근거가 하나 이상이고, 모두 그 항목에 보낸 원문 위치인지 */
    private static boolean citesOnly(List<String> evidenceIds, Set<String> allowed) {
        return evidenceIds != null && !evidenceIds.isEmpty() && allowed.containsAll(evidenceIds);
    }

    private static List<SummaryAiRequest.Source> sources(TextChangeRow row) {
        List<SummaryAiRequest.Source> sources = new ArrayList<>();
        for (Side side : new Side[] {row.previous(), row.current()}) {
            if (side != null && side.blockNo() != null && side.text() != null) {
                sources.add(new SummaryAiRequest.Source(DocumentBlock.evidenceId(side.rceptNo(), side.blockNo()),
                        row.sectionPath(), side.text()));
            }
        }
        return sources;
    }

    private static SummaryItemRow textRow(SummaryAiResponse.Item item, int changeNo, Set<String> allowed,
            SummaryAiResponse response, LocalDateTime generatedAt) {
        String reason;
        if (item == null) {
            reason = MISSING;
        } else if (!"OK".equals(item.status())) {
            reason = reason(item);
        } else if (item.sentence() == null || item.sentence().isBlank() || !citesOnly(item.evidenceIds(), allowed)) {
            reason = BAD_EVIDENCE;
        } else {
            return new SummaryItemRow(SummaryItemRow.TEXT, SummaryItemRow.SHOWN, null, item.sentence(), null,
                    item.evidenceIds(), null, changeNo, null, response.model(), response.promptVersion(),
                    generatedAt, List.of());
        }
        return new SummaryItemRow(SummaryItemRow.TEXT, SummaryItemRow.REVIEW_NEEDED, null, null, null, List.of(),
                null, changeNo, reason, null, null, null, blocked(item));
    }

    private static SummaryItemRow financialRow(SummaryAiResponse.Item item, int index, FinancialChangeRow row,
            Set<String> allowed, SummaryAiResponse response, LocalDateTime generatedAt) {
        String fact = FinancialFacts.sentence(row);
        String reason;
        if (item == null) {
            if (allowed.isEmpty()) {
                return notFound(fact, index);
            }
            reason = MISSING;
        } else if (!"OK".equals(item.status())) {
            reason = reason(item);
        } else if (item.explanation() == null) {
            return notFound(fact, index);
        } else if (!citesOnly(item.evidenceIds(), allowed)) {
            reason = BAD_EVIDENCE;
        } else {
            return new SummaryItemRow(SummaryItemRow.FINANCIAL, SummaryItemRow.SHOWN, fact, item.explanation(),
                    "FOUND", item.evidenceIds(), index, null, null, response.model(), response.promptVersion(),
                    generatedAt, List.of());
        }
        // 수치 문장(코드가 만듦)은 보이고, 설명만 검토 필요로 둔다
        return new SummaryItemRow(SummaryItemRow.FINANCIAL, SummaryItemRow.SHOWN, fact, null,
                SummaryItemRow.REVIEW_NEEDED, List.of(), index, null, reason, null, null, null, blocked(item));
    }

    private static SummaryItemRow notFound(String fact, int index) {
        return new SummaryItemRow(SummaryItemRow.FINANCIAL, SummaryItemRow.SHOWN, fact, null, "NOT_FOUND", List.of(),
                index, null, null, null, null, null, List.of());
    }

    /** 투자 권유성 표현 검사(5.5)에 걸린 규칙. 없으면 빈 목록 */
    private static List<String> blocked(SummaryAiResponse.Item item) {
        return item == null || item.blockedRules() == null ? List.of() : item.blockedRules();
    }

    private static String reason(SummaryAiResponse.Item item) {
        return item.reviewReason() == null ? "근거를 확인하지 못했어요." : item.reviewReason();
    }

    private static LlmCallRow call(SummaryAiResponse.Call call) {
        return new LlmCallRow(call.task(), call.provider(), call.model(), call.promptVersion(), time(call.calledAt()),
                call.traceId(), call.inputTokens(), call.outputTokens(),
                call.latencyMs() == null ? 0 : call.latencyMs(), call.attempt() == null ? 1 : call.attempt(),
                call.outcome(), call.error());
    }

    private static LocalDateTime time(String value) {
        try {
            return value == null ? null : LocalDateTime.parse(value);
        } catch (DateTimeParseException e) {
            return null;
        }
    }
}
