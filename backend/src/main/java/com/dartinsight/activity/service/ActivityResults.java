package com.dartinsight.activity.service;

import com.dartinsight.activity.domain.ActivityPayload;
import com.dartinsight.activity.domain.ActivityPayload.Evidence;
import com.dartinsight.activity.domain.ActivityPayload.Impact;
import com.dartinsight.activity.domain.ActivityPayload.Item;
import com.dartinsight.activity.domain.ActivityPayload.Overview;
import com.dartinsight.activity.domain.ActivityPayload.Quote;
import com.dartinsight.activity.domain.ActivityRecord;
import com.dartinsight.activity.domain.ActivityStatus;
import com.dartinsight.activity.dto.ActivityAiResponse;
import com.dartinsight.aiserver.client.AiServerException;
import com.dartinsight.summary.domain.LlmCallRow;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;

/**
 * AI 서버 응답을 저장할 결과로 바꾼다(ADR-0067). backend도 근거가 보낸 원문 위치인지 다시 확인하고, 확인하지 못한 카드는 뺀다.
 * 신호·분야·영향 종류는 AI 서버가 검증한 값이지만, 모르는 값이 오면 그 카드를 뺀다(화면이 모르는 값을 보이지 않게).
 */
final class ActivityResults {

    static final String TASK = "period_activity";
    static final String NOT_CONFIRMED = "AI가 만든 활동의 근거 위치를 확인하지 못했어요.";
    private static final Set<String> AREAS = Set.of("BUSINESS", "INVESTMENT", "FINANCE", "SHAREHOLDER",
            "GOVERNANCE", "PEOPLE", "RISK", "OTHER");
    private static final Set<String> AUDIENCES = Set.of("INVESTOR", "CAREER", "PARTNER");
    private static final Set<String> SIGNALS = Set.of("POSITIVE", "CAUTION", "HOLD");
    private static final Set<String> IMPACT_KINDS = Set.of("DISCLOSED", "OUTLOOK", "CHECK");
    private static final Set<String> TONES = Set.of("GOOD", "BAD");

    private ActivityResults() {
    }

    /** 상태가 없거나 모르는 값이면 AI 서버 응답이 깨진 것으로 본다 */
    static ActivityAiResponse requireStatus(ActivityAiResponse response) {
        if (response == null || ActivityStatus.parse(response.status()) == null) {
            throw new AiServerException(null, "AI 서버 활동 응답을 읽지 못했어요.", null);
        }
        return response;
    }

    /** AI가 후보가 없어 부르지 않고 끝냈는지(저장하지 않음) */
    static boolean notCalled(ActivityAiResponse response) {
        return response.calls() == null || response.calls().isEmpty();
    }

    static ActivityRecord interpret(Long analysisId, String promptVersion, ActivityAiResponse response,
            Map<String, Evidence> evidence, String traceId, LocalDateTime now) {
        ActivityStatus status = ActivityStatus.parse(response.status());
        List<ActivityAiResponse.Item> raw = response.items() == null ? List.of() : response.items();
        List<Item> items = new ArrayList<>();
        for (ActivityAiResponse.Item entry : raw) {
            item(items.size() + 1, entry, evidence).ifPresent(items::add);
        }
        int dropped = (response.droppedCount() == null ? 0 : response.droppedCount()) + raw.size() - items.size();
        int candidates = response.candidateCount() == null ? 0 : response.candidateCount();
        String reviewReason = response.reviewReason();
        if (status == ActivityStatus.GENERATED && items.isEmpty()) {
            status = ActivityStatus.REVIEW_NEEDED;
            reviewReason = NOT_CONFIRMED;
        }
        Overview overview = status == ActivityStatus.GENERATED ? overview(response.overview(), evidence) : null;
        List<Item> kept = status == ActivityStatus.GENERATED ? items : List.of();
        return new ActivityRecord(null, analysisId, promptVersion, status,
                new ActivityPayload(overview, kept, dropped, candidates), reviewReason,
                response.blockedRules() == null ? List.of() : response.blockedRules(),
                response.signalTableVersion(), response.model(), time(response.generatedAt()), traceId, now);
    }

    static List<LlmCallRow> calls(ActivityAiResponse response, String traceId) {
        return response.calls() == null ? List.of() : response.calls().stream().map(c -> call(c, traceId)).toList();
    }

    private static Optional<Item> item(int no, ActivityAiResponse.Item entry, Map<String, Evidence> evidence) {
        if (entry == null || !AREAS.contains(entry.area()) || !SIGNALS.contains(entry.signal())
                || blank(entry.title()) || blank(entry.summary()) || entry.audiences() == null
                || entry.audiences().isEmpty() || !AUDIENCES.containsAll(entry.audiences())) {
            return Optional.empty();
        }
        Optional<List<Quote>> facts = quotes(entry.facts(), evidence);
        if (facts.isEmpty() || facts.get().isEmpty() || entry.impacts() == null || entry.impacts().isEmpty()) {
            return Optional.empty();
        }
        List<Impact> impacts = new ArrayList<>();
        for (ActivityAiResponse.Impact impact : entry.impacts()) {
            Optional<Impact> checked = impact(impact, evidence);
            if (checked.isEmpty()) {
                return Optional.empty();
            }
            impacts.add(checked.get());
        }
        List<Long> changeIds = new ArrayList<>();
        facts.get().forEach(q -> addOnce(changeIds, q.evidence().changeId()));
        impacts.forEach(i -> i.premises().forEach(q -> addOnce(changeIds, q.evidence().changeId())));
        return Optional.of(new Item(no, entry.area(), List.copyOf(entry.audiences()), entry.title().strip(),
                entry.summary().strip(), facts.get(), entry.signal(), entry.holdReason(), entry.signalKind(),
                entry.signalKindName(), entry.signalChange(), entry.signalChangeName(), impacts,
                List.copyOf(changeIds)));
    }

    private static Optional<Impact> impact(ActivityAiResponse.Impact impact, Map<String, Evidence> evidence) {
        if (impact == null || !IMPACT_KINDS.contains(impact.kind()) || blank(impact.text())
                || (impact.tone() != null && !TONES.contains(impact.tone()))) {
            return Optional.empty();
        }
        Optional<List<Quote>> premises = quotes(impact.premises(), evidence);
        boolean needsPremise = !"CHECK".equals(impact.kind());
        if (premises.isEmpty() || (needsPremise && premises.get().isEmpty())) {
            return Optional.empty();
        }
        return Optional.of(new Impact(impact.kind(), "OUTLOOK".equals(impact.kind()) ? impact.tone() : null,
                impact.text().strip(), premises.get()));
    }

    /** 인용 모두의 근거가 보낸 원문 위치일 때만. 하나라도 모르면 empty */
    private static Optional<List<Quote>> quotes(List<ActivityAiResponse.Quote> raw, Map<String, Evidence> evidence) {
        if (raw == null) {
            return Optional.of(List.of());
        }
        List<Quote> quotes = new ArrayList<>();
        for (ActivityAiResponse.Quote quote : raw) {
            Evidence where = quote == null ? null : evidence.get(quote.evidenceId());
            if (where == null || blank(quote.quote())) {
                return Optional.empty();
            }
            quotes.add(new Quote(quote.quote(), where));
        }
        return Optional.of(quotes);
    }

    private static Overview overview(ActivityAiResponse.Overview raw, Map<String, Evidence> evidence) {
        if (raw == null || blank(raw.text()) || raw.evidenceIds() == null || raw.evidenceIds().isEmpty()) {
            return null;
        }
        List<Evidence> where = raw.evidenceIds().stream().distinct().map(evidence::get).toList();
        return where.stream().anyMatch(Objects::isNull) ? null : new Overview(raw.text().strip(), where);
    }

    private static void addOnce(List<Long> ids, Long id) {
        if (id != null && !ids.contains(id)) {
            ids.add(id);
        }
    }

    private static boolean blank(String value) {
        return value == null || value.isBlank();
    }

    private static LlmCallRow call(ActivityAiResponse.Call call, String traceId) {
        return new LlmCallRow(call.task() == null ? TASK : call.task(), call.provider(), call.model(),
                call.promptVersion(), time(call.calledAt()), call.traceId() == null ? traceId : call.traceId(),
                call.inputTokens(), call.outputTokens(), call.latencyMs() == null ? 0 : call.latencyMs(),
                call.attempt() == null ? 1 : call.attempt(), call.outcome(), call.error(), call.cachedInputTokens(),
                call.reasoningTokens());
    }

    /** AI 서버 시각(오프셋이 붙을 수 있음)을 한국 시간 LocalDateTime으로. 읽지 못하면 null */
    private static LocalDateTime time(String value) {
        if (value == null) {
            return null;
        }
        try {
            return OffsetDateTime.parse(value).toLocalDateTime();
        } catch (DateTimeParseException e) {
            try {
                return LocalDateTime.parse(value);
            } catch (DateTimeParseException ignored) {
                return null;
            }
        }
    }
}
