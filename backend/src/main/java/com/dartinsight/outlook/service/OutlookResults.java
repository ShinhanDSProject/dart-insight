package com.dartinsight.outlook.service;

import com.dartinsight.aiserver.client.AiServerException;
import com.dartinsight.outlook.domain.OutlookCategory;
import com.dartinsight.outlook.domain.OutlookItem;
import com.dartinsight.outlook.domain.OutlookQuote;
import com.dartinsight.outlook.domain.OutlookRecord;
import com.dartinsight.outlook.domain.OutlookSource;
import com.dartinsight.outlook.domain.OutlookStatus;
import com.dartinsight.outlook.domain.ReportOutlook;
import com.dartinsight.outlook.dto.OutlookAiResponse;
import com.dartinsight.summary.domain.LlmCallRow;
import java.time.LocalDateTime;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * AI 서버 전망·계획 응답 판정(OutlookService). 항목의 근거가 보낸 문단인지, 인용이 그 문단 글에 있는지 여기서 다시 확인한다.
 */
final class OutlookResults {

    static final String TASK = "outlook";
    static final String BAD_EVIDENCE = "전망·계획 항목의 인용이나 근거가 보낸 원문과 맞지 않아 쓰지 않았어요.";

    private static final Logger log = LoggerFactory.getLogger(OutlookResults.class);

    private OutlookResults() {
    }

    /** 상태가 없는 응답은 AI 서버를 쓸 수 없는 것으로 본다 */
    static OutlookAiResponse requireStatus(OutlookAiResponse response) {
        if (response == null || response.status() == null) {
            throw new AiServerException(null, "AI 서버 전망·계획 응답이 비어 있어요.", null);
        }
        return response;
    }

    static List<LlmCallRow> calls(OutlookAiResponse response, String traceId) {
        return response.calls() == null ? List.of() : response.calls().stream().map(c -> call(c, traceId)).toList();
    }

    /**
     * AI 서버 결과를 저장할 기록으로 바꾼다. 항목 하나라도 확인하지 못하면 항목 없이 검토 필요다.
     * 확인한 항목이 0개면 EMPTY, 알 수 없는 상태는 검토 필요다.
     */
    static OutlookRecord interpret(String rceptNo, String promptVersion, OutlookAiResponse response,
            List<OutlookSource> sources, String traceId, LocalDateTime createdAt) {
        List<String> blocked = response.blockedRules() == null ? List.of() : response.blockedRules();
        Map<String, OutlookSource> byEvidence = sources.stream()
                .collect(Collectors.toMap(OutlookSource::evidenceId, Function.identity(), (a, b) -> a));
        OutlookStatus status;
        String reason = null;
        List<OutlookItem> items = List.of();
        if (OutlookStatus.GENERATED.name().equals(response.status())
                || OutlookStatus.EMPTY.name().equals(response.status())) {
            Optional<List<OutlookItem>> verified = verifiedItems(rceptNo, response.items(), byEvidence);
            if (verified.isEmpty()) {
                log.warn("AI 서버 전망·계획의 인용·근거를 확인하지 못해 검토 필요로 둡니다");
                status = OutlookStatus.REVIEW_NEEDED;
                reason = BAD_EVIDENCE;
            } else {
                items = verified.get();
                status = items.isEmpty() ? OutlookStatus.EMPTY : OutlookStatus.GENERATED;
            }
        } else {
            if (!OutlookStatus.REVIEW_NEEDED.name().equals(response.status())) {
                log.warn("AI 서버 전망·계획 상태를 알 수 없어 검토 필요로 둡니다: {}", response.status());
            }
            status = OutlookStatus.REVIEW_NEEDED;
            reason = response.reviewReason() == null ? ReportOutlook.NOT_VERIFIED : response.reviewReason();
        }
        return new OutlookRecord(null, rceptNo, promptVersion, status, items, reason, blocked, response.model(),
                time(response.generatedAt()), traceId, createdAt);
    }

    /** 모든 항목을 확인했으면 그 항목들, 하나라도 확인하지 못하면 empty */
    private static Optional<List<OutlookItem>> verifiedItems(String rceptNo, List<OutlookAiResponse.Item> raw,
            Map<String, OutlookSource> byEvidence) {
        List<OutlookItem> items = new ArrayList<>();
        for (OutlookAiResponse.Item entry : raw == null ? List.<OutlookAiResponse.Item>of() : raw) {
            Optional<OutlookItem> item = item(rceptNo, entry, byEvidence);
            if (item.isEmpty()) {
                return Optional.empty();
            }
            items.add(item.get());
        }
        return Optional.of(items);
    }

    /** 종류가 정한 값이고, 근거가 모두 보낸 문단이며, 인용이 그중 한 문단 글에 있어야 한다. 근거 위치는 인용이 든 첫 문단 */
    private static Optional<OutlookItem> item(String rceptNo, OutlookAiResponse.Item entry,
            Map<String, OutlookSource> byEvidence) {
        if (entry == null || entry.summary() == null || entry.summary().isBlank() || entry.evidenceIds() == null
                || entry.evidenceIds().isEmpty()) {
            return Optional.empty();
        }
        OutlookCategory category = OutlookCategory.parse(entry.category());
        if (category == null || entry.evidenceIds().stream().anyMatch(id -> !byEvidence.containsKey(id))) {
            return Optional.empty();
        }
        return entry.evidenceIds().stream().distinct().map(byEvidence::get).filter(s -> s.contains(entry.quote()))
                .findFirst().map(source -> new OutlookItem(category, entry.summary().strip(),
                        OutlookQuote.normalize(entry.quote()), OutlookItem.Evidence.of(rceptNo, source)));
    }

    private static LlmCallRow call(OutlookAiResponse.Call call, String traceId) {
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
}
