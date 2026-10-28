package com.dartinsight.followup.service;

import com.dartinsight.aiserver.client.AiServerException;
import com.dartinsight.followup.domain.CompanyPlan;
import com.dartinsight.followup.domain.FollowupStatus;
import com.dartinsight.followup.domain.PlanCandidate;
import com.dartinsight.followup.domain.PlanFollowupItem;
import com.dartinsight.followup.domain.PlanFollowupItem.FollowupSide;
import com.dartinsight.followup.domain.PlanFollowupRecord;
import com.dartinsight.followup.domain.PlanFollowupResult;
import com.dartinsight.followup.domain.PlanFollowupStatus;
import com.dartinsight.followup.dto.PlanFollowupAiResponse;
import com.dartinsight.outlook.domain.OutlookQuote;
import com.dartinsight.summary.domain.LlmCallRow;
import java.time.LocalDateTime;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * AI 서버 대조 응답 판정(PlanFollowupService). 계획마다 하나씩 답했는지, 근거가 그 계획에 보낸 후보인지,
 * 인용이 그 후보 글에 있는지 여기서 다시 확인한다(ADR-0041).
 */
final class PlanFollowupResults {

    static final String TASK = "plan_followup";
    static final String BAD_EVIDENCE = "대조 결과의 인용이나 근거가 보낸 원문과 맞지 않아 쓰지 않았어요.";

    private static final Logger log = LoggerFactory.getLogger(PlanFollowupResults.class);

    private PlanFollowupResults() {
    }

    /** 상태가 없는 응답은 AI 서버를 쓸 수 없는 것으로 본다 */
    static PlanFollowupAiResponse requireStatus(PlanFollowupAiResponse response) {
        if (response == null || response.status() == null) {
            throw new AiServerException(null, "AI 서버 대조 응답이 비어 있어요.", null);
        }
        return response;
    }

    static List<LlmCallRow> calls(PlanFollowupAiResponse response, String traceId) {
        return response.calls() == null ? List.of() : response.calls().stream().map(c -> call(c, traceId)).toList();
    }

    /** AI 서버 결과를 저장할 기록으로 바꾼다. 계획 하나라도 확인하지 못하면 항목 없이 검토 필요다 */
    static PlanFollowupRecord interpret(String previousRceptNo, String currentRceptNo, String promptVersion,
            PlanFollowupAiResponse response, List<CompanyPlan> plans, Map<Integer, List<PlanCandidate>> candidates,
            String traceId, LocalDateTime createdAt) {
        List<String> blocked = response.blockedRules() == null ? List.of() : response.blockedRules();
        PlanFollowupStatus status = PlanFollowupStatus.REVIEW_NEEDED;
        String reason;
        List<PlanFollowupItem> items = List.of();
        if (PlanFollowupStatus.GENERATED.name().equals(response.status())) {
            Optional<List<PlanFollowupItem>> verified = verifiedItems(response.followups(), plans, candidates);
            if (verified.isPresent()) {
                status = PlanFollowupStatus.GENERATED;
                items = verified.get();
                reason = null;
            } else {
                log.warn("AI 서버 대조의 인용·근거를 확인하지 못해 검토 필요로 둡니다");
                reason = BAD_EVIDENCE;
            }
        } else {
            if (!PlanFollowupStatus.REVIEW_NEEDED.name().equals(response.status())) {
                log.warn("AI 서버 대조 상태를 알 수 없어 검토 필요로 둡니다: {}", response.status());
            }
            reason = response.reviewReason() == null ? PlanFollowupResult.NOT_VERIFIED : response.reviewReason();
        }
        return new PlanFollowupRecord(null, previousRceptNo, currentRceptNo, promptVersion, status, items, reason,
                blocked, response.model(), time(response.generatedAt()), traceId, createdAt);
    }

    /** 계획마다 정확히 하나씩, 모두 확인했으면 계획 순서의 항목. 아니면 empty */
    private static Optional<List<PlanFollowupItem>> verifiedItems(List<PlanFollowupAiResponse.Followup> raw,
            List<CompanyPlan> plans, Map<Integer, List<PlanCandidate>> candidates) {
        Map<String, PlanFollowupAiResponse.Followup> byPlan = new HashMap<>();
        for (PlanFollowupAiResponse.Followup entry : raw == null ? List.<PlanFollowupAiResponse.Followup>of() : raw) {
            if (entry == null || byPlan.putIfAbsent(entry.planId(), entry) != null) {
                return Optional.empty();
            }
        }
        if (byPlan.size() != plans.size()) {
            return Optional.empty();
        }
        List<PlanFollowupItem> items = new ArrayList<>();
        for (CompanyPlan plan : plans) {
            Optional<FollowupSide> side = side(byPlan.get(plan.planId()),
                    candidates.getOrDefault(plan.planNo(), List.of()));
            if (side.isEmpty()) {
                return Optional.empty();
            }
            items.add(PlanFollowupItem.of(plan, side.get()));
        }
        return Optional.of(items);
    }

    /**
     * NOT_FOUND는 근거·인용이 없어야 하고, MENTIONED·CHANGED는 근거가 모두 그 계획의 후보이며 인용이 그중 한 글에 있어야 한다.
     * 근거 위치는 인용이 든 첫 후보.
     */
    private static Optional<FollowupSide> side(PlanFollowupAiResponse.Followup entry, List<PlanCandidate> candidates) {
        FollowupStatus status = entry == null ? null : FollowupStatus.parse(entry.status());
        if (status == null) {
            return Optional.empty();
        }
        List<String> ids = entry.evidenceIds() == null ? List.of() : entry.evidenceIds();
        if (!status.cited()) {
            boolean clean = ids.isEmpty() && (entry.quote() == null || entry.quote().isBlank());
            return clean ? Optional.of(FollowupSide.notFound()) : Optional.empty();
        }
        Map<String, PlanCandidate> byEvidence = new HashMap<>();
        candidates.forEach(c -> byEvidence.put(c.evidenceId(), c));
        if (entry.summary() == null || entry.summary().isBlank() || ids.isEmpty()
                || ids.stream().anyMatch(id -> !byEvidence.containsKey(id))) {
            return Optional.empty();
        }
        return ids.stream().distinct().map(byEvidence::get).filter(c -> c.contains(entry.quote())).findFirst()
                .map(c -> new FollowupSide(status, entry.summary().strip(), OutlookQuote.normalize(entry.quote()),
                        c.evidence()));
    }

    private static LlmCallRow call(PlanFollowupAiResponse.Call call, String traceId) {
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
