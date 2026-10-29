package com.dartinsight.summary.service;

import com.dartinsight.analysis.domain.FinancialChangeRow;
import com.dartinsight.analysis.domain.TextChangeRow;
import com.dartinsight.analysis.domain.TextChangeRow.Side;
import com.dartinsight.document.domain.DocumentBlock;
import com.dartinsight.summary.domain.AccountAliases;
import com.dartinsight.summary.domain.FinancialFacts;
import com.dartinsight.summary.domain.LlmCallRow;
import com.dartinsight.summary.domain.SummaryItemRow;
import com.dartinsight.summary.domain.SummaryResult;
import com.dartinsight.summary.domain.SummaryStatus;
import com.dartinsight.summary.dto.SummaryAiRequest;
import com.dartinsight.summary.dto.SummaryAiResponse;
import java.time.LocalDateTime;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Predicate;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.json.JsonMapper;

/**
 * AI 서버 요약 요청 만들기와 응답 판정(SummaryService). 항목마다 근거가 그 항목에 보낸 원문 위치인지 여기서 다시 확인한다.
 * 판정·템플릿 요약을 바꿔 저장되는 요약이 달라지면 {@code Analysis.CURRENT_VERSION}을 함께 올린다.
 */
final class SummaryResults {

    static final String FINANCIAL_REF = "F";
    static final String TEXT_REF = "T";
    private static final Logger log = LoggerFactory.getLogger(SummaryResults.class);
    private static final String MISSING = "요약 결과에 이 항목이 없었어요.";
    private static final String BAD_EVIDENCE = "요약 문장의 근거가 보낸 원문 위치가 아니라 쓰지 않았어요.";
    private static final String BAD_QUOTE = "설명의 등급이나 인용 위치를 확인하지 못해 쓰지 않았어요.";

    private SummaryResults() {
    }

    /** 줄 가운데 검토 필요가 하나라도 있으면 PARTIAL, 아니면 COMPLETED */
    static SummaryResult result(List<SummaryItemRow> rows, SummaryAiResponse response) {
        boolean review = rows.stream().anyMatch(r -> r.reviewNeeded() || r.explanationReviewNeeded());
        return new SummaryResult(review ? SummaryStatus.PARTIAL : SummaryStatus.COMPLETED,
                review ? "근거를 확인하지 못한 항목은 요약에서 빼고 '검토 필요'로 남겼어요." : null, rows, calls(response));
    }

    /** 응답에서 그 항목 ID의 첫 항목. 없으면 null */
    static SummaryAiResponse.Item answer(SummaryAiResponse response, String ref) {
        return response.items().stream().filter(i -> i != null && ref.equals(i.ref())).findFirst().orElse(null);
    }

    /** 짝지은 원문(블록 번호와 글이 있는 쪽)이 하나라도 있어 풀이할 수 있는 변경인지. 검토 필요 유형은 풀이하지 않는다 */
    static boolean explainable(TextChangeRow row) {
        return !TextChangeRow.REVIEW_NEEDED.equals(row.changeType()) && !sources(row).isEmpty();
    }

    /** 요청 항목 ID(F1·T3처럼 접두어 + 목록 안 순서 + 1) → 목록 안 순서 */
    static Map<String, Integer> refs(String prefix, List<Integer> picked) {
        Map<String, Integer> refs = new HashMap<>();
        picked.forEach(index -> refs.put(prefix + (index + 1), index));
        return refs;
    }

    static SummaryAiRequest.FinancialItem financialItem(FinancialChangeRow row, int index) {
        List<String> terms = AccountAliases.of(row.current() == null ? null : row.current().accountId(),
                row.accountName());
        return new SummaryAiRequest.FinancialItem(FINANCIAL_REF + (index + 1), row.accountName(), row.direction(),
                terms);
    }

    static SummaryAiRequest.TextItem textItem(TextChangeRow row, int index) {
        return new SummaryAiRequest.TextItem(TEXT_REF + (index + 1), row.changeType(), row.sectionPath(),
                sources(row));
    }

    /**
     * 항목 ID → 응답 항목. AI 서버도 확인하지만, 저장하기 전에 여기서 다시 본다: 요청한 항목인지, 겹치지 않는지
     * (근거가 보낸 원문 위치인지는 줄을 만들 때 본다. 재무 설명은 보낸 문단 중 어느 것이든. 후보는 AI 서버가 그 안에서 골랐다)
     */
    static Map<String, SummaryAiResponse.Item> answers(SummaryAiResponse response,
            Predicate<String> requested) {
        Map<String, SummaryAiResponse.Item> answers = new LinkedHashMap<>();
        for (SummaryAiResponse.Item item : response.items()) {
            if (item == null || !requested.test(item.ref())) {
                log.warn("요약 응답에 요청하지 않은 항목이 있어 뺐습니다: {}", item == null ? null : item.ref());
            } else if (answers.putIfAbsent(item.ref(), item) != null) {
                log.warn("요약 응답에 같은 항목이 두 번 있어 처음 것만 씁니다: {}", item.ref());
            }
        }
        return answers;
    }

    static List<LlmCallRow> calls(SummaryAiResponse response) {
        return response.calls() == null ? List.of() : response.calls().stream().map(SummaryResults::call).toList();
    }

    static Set<String> ids(List<SummaryAiRequest.Source> sources) {
        Set<String> ids = new HashSet<>();
        sources.forEach(s -> ids.add(s.evidenceId()));
        return ids;
    }

    /** 근거가 하나 이상이고, 모두 그 항목에 보낸 원문 위치인지 */
    private static boolean citesOnly(List<String> evidenceIds, Set<String> allowed) {
        return evidenceIds != null && !evidenceIds.isEmpty() && allowed.containsAll(evidenceIds);
    }

    static List<SummaryAiRequest.Source> sources(TextChangeRow row) {
        List<SummaryAiRequest.Source> sources = new ArrayList<>();
        for (Side side : new Side[] {row.previous(), row.current()}) {
            if (side != null && side.blockNo() != null && side.text() != null) {
                sources.add(new SummaryAiRequest.Source(DocumentBlock.evidenceId(side.rceptNo(), side.blockNo()),
                        row.sectionPath(), side.text()));
            }
        }
        return sources;
    }

    static SummaryItemRow textRow(SummaryAiResponse.Item item, int changeNo, Set<String> allowed,
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

    static SummaryItemRow financialRow(SummaryAiResponse.Item item, int index, FinancialChangeRow row,
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
        // 수치 문장(코드가 만듦)은 보이고, 설명 자리는 템플릿으로 채운다(#149). LLM 설명은 실패했으니 검토 필요로도 센다
        boolean quoted = templateQuoted(item, allowed);
        return new SummaryItemRow(SummaryItemRow.FINANCIAL, SummaryItemRow.SHOWN, fact, null,
                SummaryItemRow.TEMPLATE, List.of(), index, null, reason, null, null, null, blocked(item), null,
                quoted ? item.quote() : null, quoted ? item.quoteEvidenceId() : null);
    }

    /**
     * 템플릿 요약에 쓸 인용이 있는지. AI 서버가 검토 필요로 끝낸 항목에 남긴 인용(인용 실재 검사를 통과함)만 쓰고,
     * 인용 위치가 그 항목에 보낸 후보인지 다시 본다. backend가 받아들이지 않은 OK 항목의 인용은 쓰지 않는다
     */
    private static boolean templateQuoted(SummaryAiResponse.Item item, Set<String> allowed) {
        return item != null && SummaryItemRow.REVIEW_NEEDED.equals(item.status())
                && item.quote() != null && !item.quote().isBlank()
                && item.quoteEvidenceId() != null && allowed.contains(item.quoteEvidenceId());
    }

    /** @param downgradeReason 코드가 등급을 NONE으로 낮춘 사유. 후보가 없었거나 LLM이 NONE이라 했으면 null */
    static SummaryItemRow notFound(String fact, int index, String downgradeReason) {
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

    /**
     * 실패한 요약 요청의 호출 기록(에러 응답 헤더를 푼 JSON 배열, ADR-0042). 없거나 읽지 못하면 빈 목록.
     * 읽지 못해도 분석 실패 처리는 그대로 하므로 경고만 남긴다.
     */
    static List<LlmCallRow> failedCalls(String json, JsonMapper jsonMapper) {
        if (json == null || json.isBlank()) {
            return List.of();
        }
        try {
            SummaryAiResponse.Call[] calls = jsonMapper.readValue(json, SummaryAiResponse.Call[].class);
            return calls == null ? List.of() : Arrays.stream(calls).filter(Objects::nonNull)
                    .map(SummaryResults::call).toList();
        } catch (JacksonException e) {
            log.warn("실패한 요약 요청의 LLM 호출 기록을 읽지 못했습니다: {}", e.getOriginalMessage());
            return List.of();
        }
    }

    private static LlmCallRow call(SummaryAiResponse.Call call) {
        return new LlmCallRow(call.task(), call.provider(), call.model(), call.promptVersion(), time(call.calledAt()),
                call.traceId(), call.inputTokens(), call.outputTokens(),
                call.latencyMs() == null ? 0 : call.latencyMs(), call.attempt() == null ? 1 : call.attempt(),
                call.outcome(), call.error());
    }

    static LocalDateTime time(String value) {
        try {
            return value == null ? null : LocalDateTime.parse(value);
        } catch (DateTimeParseException e) {
            return null;
        }
    }
}
