package com.dartinsight.summary.service;

import com.dartinsight.aiserver.client.AiServerClient;
import com.dartinsight.aiserver.client.AiServerException;
import com.dartinsight.aiserver.client.AiServerPaths;
import com.dartinsight.analysis.domain.FinancialChangeRow;
import com.dartinsight.analysis.domain.TextChangeRow;
import com.dartinsight.analysis.domain.TextChangeRow.Side;
import com.dartinsight.document.domain.DocumentBlock;
import com.dartinsight.document.domain.DocumentSection;
import com.dartinsight.document.service.DocumentService;
import com.dartinsight.document.domain.ReportDocument;
import com.dartinsight.summary.domain.LlmCallRow;
import com.dartinsight.summary.domain.SummaryItemRow;
import com.dartinsight.summary.domain.SummaryResult;
import com.dartinsight.summary.domain.SummaryStatus;
import com.dartinsight.summary.dto.SummaryAiRequest;
import com.dartinsight.summary.dto.SummaryAiResponse;
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
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * 근거 기반 요약(3.2). 코드가 요약할 변화를 고르고 사실 문장(수치)을 만들며, AI 서버(LLM)는 문장 변화의 요약과
 * 공시에 적힌 설명만 쓴다. AI 서버가 근거·숫자를 확인해 통과하지 못한 항목은 '검토 필요'로 돌려준다.
 * AI 서버·LLM을 부를 수 없으면 {@link com.dartinsight.aiserver.client.AiServerException}을 그대로 던진다(분석 실패).
 */
@Service
@RequiredArgsConstructor
public class SummaryService {

    private static final Logger log = LoggerFactory.getLogger(SummaryService.class);
    private static final String MISSING = "요약 결과에 이 항목이 없었어요.";
    private static final String BAD_EVIDENCE = "요약 문장의 근거가 보낸 원문 위치가 아니라 쓰지 않았어요.";
    private static final String BAD_QUOTE = "설명의 등급이나 인용 위치를 확인하지 못해 쓰지 않았어요.";

    private final AiServerClient aiServerClient;
    private final DocumentService documentService;

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
        // 재무 설명 후보는 AI 서버가 이 문단들에서 검색어로 고른다(ADR-0032)
        List<SummaryAiRequest.Source> paragraphs = SummarySelector.paragraphs(sections, blocks);

        Map<String, Integer> financialRefs = new HashMap<>();
        List<SummaryAiRequest.FinancialItem> financialItems = new ArrayList<>();
        for (int index : financialPicked) {
            FinancialChangeRow row = financial.get(index);
            String ref = "F" + (index + 1);
            financialRefs.put(ref, index);
            List<String> terms = AccountAliases.of(row.current() == null ? null : row.current().accountId(),
                    row.accountName());
            financialItems.add(new SummaryAiRequest.FinancialItem(ref, row.accountName(), row.direction(), terms));
        }
        Map<String, Integer> textRefs = new HashMap<>();
        List<SummaryAiRequest.TextItem> textItems = new ArrayList<>();
        for (int index : textPicked) {
            TextChangeRow row = text.get(index);
            String ref = "T" + (index + 1);
            textRefs.put(ref, index);
            textItems.add(new SummaryAiRequest.TextItem(ref, row.changeType(), row.sectionPath(), sources(row)));
        }

        if (textItems.isEmpty() && paragraphs.isEmpty()) {
            // LLM이 쓸 것이 없으면(문장 변화도 설명을 찾을 원문도 없음) AI 서버를 부르지 않는다
            List<SummaryItemRow> rows = financialPicked.stream()
                    .map(i -> notFound(FinancialFacts.sentence(financial.get(i)), i, null))
                    .toList();
            return new SummaryResult(SummaryStatus.COMPLETED, null, rows, List.of());
        }

        SummaryAiResponse response = aiServerClient.postJson(AiServerPaths.SUMMARIES, new SummaryAiRequest(
                companyName, previousReport, currentReport, textItems, financialItems, paragraphs),
                SummaryAiResponse.class);
        if (response == null || response.items() == null) {
            throw new AiServerException(null, "AI 서버 요약 응답이 비어 있어요.", null);
        }
        LocalDateTime generatedAt = time(response.generatedAt());

        // AI 서버도 확인하지만, 저장하기 전에 여기서 다시 본다: 요청한 항목인지, 겹치지 않는지, 근거가 보낸 원문 위치인지
        // (재무 설명은 보낸 문단 중 어느 것이든. 후보는 AI 서버가 그 안에서 골랐다)
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
        Set<String> paragraphIds = ids(paragraphs);
        for (SummaryAiRequest.FinancialItem item : financialItems) {
            int index = financialRefs.get(item.ref());
            rows.add(financialRow(answers.get(item.ref()), index, financial.get(index), paragraphIds, response,
                    generatedAt));
        }
        boolean review = rows.stream().anyMatch(r -> SummaryItemRow.REVIEW_NEEDED.equals(r.status())
                || SummaryItemRow.REVIEW_NEEDED.equals(r.explanationStatus()));
        List<LlmCallRow> calls = response.calls() == null ? List.of()
                : response.calls().stream().map(SummaryService::call).toList();
        return new SummaryResult(review ? SummaryStatus.PARTIAL : SummaryStatus.COMPLETED,
                review ? "근거를 확인하지 못한 항목은 요약에서 빼고 '검토 필요'로 남겼어요." : null, rows, calls);
    }

    /**
     * 문장 변경 하나의 한 줄 풀이(3.11). 요약과 같은 /internal/summaries를 문장 항목 하나로 부르고, 요약과 같은 기준으로
     * 근거를 확인한다. 원문이 없는 변경({@link #explainable})은 부르지 않는다(호출하는 쪽이 먼저 거른다).
     *
     * @return 그 변경의 요약 한 줄(SHOWN이면 aiText가 풀이, REVIEW_NEEDED면 reviewReason이 사유)과 LLM 호출 기록
     * @throws AiServerException AI 서버·LLM을 쓸 수 없음
     */
    public TextExplanation explain(String companyName, String previousReport, String currentReport,
            TextChangeRow row, int changeNo) {
        List<SummaryAiRequest.Source> sources = sources(row);
        if (!explainable(row)) {
            throw new IllegalStateException("원문이 없는 변경은 풀이를 만들지 않습니다: " + changeNo);
        }
        SummaryAiRequest.TextItem item = new SummaryAiRequest.TextItem("T" + changeNo, row.changeType(),
                row.sectionPath(), sources);
        SummaryAiResponse response = aiServerClient.postJson(AiServerPaths.SUMMARIES, new SummaryAiRequest(
                companyName, previousReport, currentReport, List.of(item), List.of(), List.of()),
                SummaryAiResponse.class);
        if (response == null || response.items() == null) {
            throw new AiServerException(null, "AI 서버 요약 응답이 비어 있어요.", null);
        }
        SummaryAiResponse.Item answer = response.items().stream()
                .filter(i -> i != null && item.ref().equals(i.ref())).findFirst().orElse(null);
        SummaryItemRow explained = textRow(answer, changeNo, ids(sources), response, time(response.generatedAt()));
        List<LlmCallRow> calls = response.calls() == null ? List.of()
                : response.calls().stream().map(SummaryService::call).toList();
        return new TextExplanation(explained, calls);
    }

    /** 짝지은 원문(블록 번호와 글이 있는 쪽)이 하나라도 있어 풀이할 수 있는 변경인지. 검토 필요 유형은 풀이하지 않는다 */
    public static boolean explainable(TextChangeRow row) {
        return !TextChangeRow.REVIEW_NEEDED.equals(row.changeType()) && !sources(row).isEmpty();
    }

    /** 문장 변경 하나의 풀이 결과와 그때의 LLM 호출 기록 */
    public record TextExplanation(SummaryItemRow row, List<LlmCallRow> calls) {
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
                return notFound(fact, index, null);
            }
            reason = MISSING;
        } else if (!"OK".equals(item.status())) {
            reason = reason(item);
        } else if (item.explanation() == null) {
            // 코드가 등급을 NONE으로 낮췄으면 AI 서버가 그 사유를 reviewReason에 준다(후보가 없던 NONE과 화면 문구가 다름)
            return notFound(fact, index, item.reviewReason());
        } else if (!citesOnly(item.evidenceIds(), allowed)) {
            reason = BAD_EVIDENCE;
        } else if (!quoted(item, allowed)) {
            reason = BAD_QUOTE;
        } else {
            return new SummaryItemRow(SummaryItemRow.FINANCIAL, SummaryItemRow.SHOWN, fact, item.explanation(),
                    SummaryItemRow.FOUND, item.evidenceIds(), index, null, item.reviewReason(), response.model(),
                    response.promptVersion(), generatedAt, List.of(), item.grade(), item.quote(),
                    item.quoteEvidenceId());
        }
        // 수치 문장(코드가 만듦)은 보이고, 설명만 검토 필요로 둔다
        return new SummaryItemRow(SummaryItemRow.FINANCIAL, SummaryItemRow.SHOWN, fact, null,
                SummaryItemRow.REVIEW_NEEDED, List.of(), index, null, reason, null, null, null, blocked(item));
    }

    /** @param downgradeReason 코드가 등급을 NONE으로 낮춘 사유. 후보가 없었거나 LLM이 NONE이라 했으면 null */
    private static SummaryItemRow notFound(String fact, int index, String downgradeReason) {
        return new SummaryItemRow(SummaryItemRow.FINANCIAL, SummaryItemRow.SHOWN, fact, null,
                SummaryItemRow.NOT_FOUND, List.of(), index, null, downgradeReason, null, null, null, List.of(),
                SummaryItemRow.NONE, null, null);
    }

    /** 설명의 등급이 STATED·RELATED이고, 인용문이 있으며 인용 위치가 그 항목에 보낸 후보이자 설명의 근거인지 */
    private static boolean quoted(SummaryAiResponse.Item item, Set<String> allowed) {
        return (SummaryItemRow.STATED.equals(item.grade()) || SummaryItemRow.RELATED.equals(item.grade()))
                && item.quote() != null && !item.quote().isBlank()
                && item.quoteEvidenceId() != null && allowed.contains(item.quoteEvidenceId())
                && item.evidenceIds().contains(item.quoteEvidenceId());
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
