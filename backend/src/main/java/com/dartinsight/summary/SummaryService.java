package com.dartinsight.summary;

import com.dartinsight.aiserver.AiServerClient;
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
import java.util.List;
import java.util.Map;
import java.util.Optional;
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
                            null, null, null))
                    .toList();
            return new SummaryResult(SummaryStatus.COMPLETED, null, rows, List.of());
        }

        SummaryAiResponse response = aiServerClient.postJson("/internal/summaries", new SummaryAiRequest(
                companyName, previousReport, currentReport, textItems, financialItems), SummaryAiResponse.class);
        if (response == null || response.items() == null) {
            throw new IllegalStateException("AI 서버 요약 응답이 비어 있습니다.");
        }
        LocalDateTime generatedAt = time(response.generatedAt());
        List<SummaryItemRow> rows = new ArrayList<>();
        for (SummaryAiResponse.Item item : response.items()) {
            if (textRefs.containsKey(item.ref())) {
                rows.add(textRow(item, textRefs.get(item.ref()) + 1, response, generatedAt));
            } else if (financialRefs.containsKey(item.ref())) {
                int index = financialRefs.get(item.ref());
                rows.add(financialRow(item, index, financial.get(index), response, generatedAt));
            } else {
                log.warn("요약 응답에 요청하지 않은 항목이 있어 뺐습니다: {}", item.ref());
            }
        }
        boolean review = rows.stream().anyMatch(r -> SummaryItemRow.REVIEW_NEEDED.equals(r.status())
                || SummaryItemRow.REVIEW_NEEDED.equals(r.explanationStatus()));
        List<LlmCallRow> calls = response.calls() == null ? List.of()
                : response.calls().stream().map(SummaryService::call).toList();
        return new SummaryResult(review ? SummaryStatus.PARTIAL : SummaryStatus.COMPLETED,
                review ? "근거를 확인하지 못한 항목은 요약에서 빼고 '검토 필요'로 남겼어요." : null, rows, calls);
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

    private static SummaryItemRow textRow(SummaryAiResponse.Item item, int changeNo, SummaryAiResponse response,
            LocalDateTime generatedAt) {
        boolean ok = "OK".equals(item.status()) && item.sentence() != null;
        return new SummaryItemRow(SummaryItemRow.TEXT, ok ? SummaryItemRow.SHOWN : SummaryItemRow.REVIEW_NEEDED, null,
                ok ? item.sentence() : null, null, ok ? list(item.evidenceIds()) : List.of(), null, changeNo,
                ok ? null : reason(item), ok ? response.model() : null, ok ? response.promptVersion() : null,
                ok ? generatedAt : null);
    }

    private static SummaryItemRow financialRow(SummaryAiResponse.Item item, int index, FinancialChangeRow row,
            SummaryAiResponse response, LocalDateTime generatedAt) {
        String fact = FinancialFacts.sentence(row);
        if (!"OK".equals(item.status())) {
            return new SummaryItemRow(SummaryItemRow.FINANCIAL, SummaryItemRow.SHOWN, fact, null,
                    SummaryItemRow.REVIEW_NEEDED, List.of(), index, null, reason(item), null, null, null);
        }
        if (item.explanation() == null) {
            return new SummaryItemRow(SummaryItemRow.FINANCIAL, SummaryItemRow.SHOWN, fact, null, "NOT_FOUND",
                    List.of(), index, null, null, null, null, null);
        }
        return new SummaryItemRow(SummaryItemRow.FINANCIAL, SummaryItemRow.SHOWN, fact, item.explanation(), "FOUND",
                list(item.evidenceIds()), index, null, null, response.model(), response.promptVersion(), generatedAt);
    }

    private static String reason(SummaryAiResponse.Item item) {
        return item.reviewReason() == null ? "근거를 확인하지 못했어요." : item.reviewReason();
    }

    private static List<String> list(List<String> values) {
        return values == null ? List.of() : values;
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
