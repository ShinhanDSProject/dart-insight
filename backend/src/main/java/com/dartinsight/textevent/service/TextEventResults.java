package com.dartinsight.textevent.service;

import com.dartinsight.analysis.domain.TextChange;
import com.dartinsight.analysis.domain.TextChangeRow.Side;
import com.dartinsight.document.domain.DocumentBlock;
import com.dartinsight.summary.domain.LlmCallRow;
import com.dartinsight.textevent.domain.NotCreatedReason;
import com.dartinsight.textevent.domain.StructuredAmount;
import com.dartinsight.textevent.domain.TextEventRow;
import com.dartinsight.textevent.dto.TextEventAiResponse;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * ai-server 응답을 저장 전에 다시 확인하고 저장 값으로 옮긴다(ADR-0050). 변경 번호와 근거 ID가 보낸 값과 어긋나면 쓰지 않는다.
 * 인용 글자 대조와 금지 표현 검사는 ai-server가 한다.
 */
final class TextEventResults {

    private static final String TASK = "text_event";
    private static final String PREVIOUS = "PREVIOUS";
    private static final String CURRENT = "CURRENT";

    private TextEventResults() {
    }

    /** 만들지 않은 사유. 저장해도 되는 사유(FAKE_MODEL, NO_CANDIDATES)가 아니면 비어 있다 */
    static Optional<NotCreatedReason> notCreatedReason(TextEventAiResponse response) {
        if (NotCreatedReason.FAKE_MODEL.name().equals(response.notCreatedReason())) {
            return Optional.of(NotCreatedReason.FAKE_MODEL);
        }
        if (NotCreatedReason.NO_CANDIDATES.name().equals(response.notCreatedReason())) {
            return Optional.of(NotCreatedReason.NO_CANDIDATES);
        }
        return Optional.empty();
    }

    /** 응답의 문제. 없으면 null */
    static String problem(TextEventAiResponse response, TextEventRequestService.Input input) {
        if (response.model() == null || response.promptVersion() == null || time(response.generatedAt()) == null) {
            return "모델 이름·프롬프트 버전·호출 시각이 없습니다.";
        }
        if (response.events() == null || response.events().isEmpty()) {
            return "사건이 없습니다.";
        }
        Set<String> structured = input.amounts().stream().map(StructuredAmount::evidenceId)
                .collect(Collectors.toSet());
        for (TextEventAiResponse.Event event : response.events()) {
            String problem = eventProblem(event, input.sent(), structured);
            if (problem != null) {
                return "사건 " + event.sortOrder() + ": " + problem;
            }
        }
        for (Integer changeNo : unbound(response)) {
            if (!input.sent().containsKey(changeNo)) {
                return "묶이지 않은 변경 " + changeNo + "은 보낸 변경이 아닙니다.";
            }
        }
        return null;
    }

    private static String eventProblem(TextEventAiResponse.Event event, Map<Integer, TextChange> sent,
            Set<String> structured) {
        if (event.changeNos() == null || event.changeNos().isEmpty()) {
            return "묶인 변경이 없습니다.";
        }
        for (Integer changeNo : event.changeNos()) {
            if (!sent.containsKey(changeNo)) {
                return "변경 " + changeNo + "은 보낸 변경이 아닙니다.";
            }
        }
        for (TextEventAiResponse.Quote quote : quotes(event)) {
            if (!event.changeNos().contains(quote.changeNo())) {
                return "인용의 변경 " + quote.changeNo() + "이 사건에 없습니다.";
            }
            if (!isAt(side(sent.get(quote.changeNo()), quote.side()), quote.evidenceId())) {
                return "인용의 근거 " + quote.evidenceId() + "이 그 변경의 원문 위치가 아닙니다.";
            }
        }
        String scale = event.scaleEvidenceId();
        if (scale != null && !structured.contains(scale) && !inLinkedBlock(scale, event, sent)) {
            return "규모의 근거 " + scale + "이 묶인 변경이나 공시 금액이 아닙니다.";
        }
        return null;
    }

    private static boolean inLinkedBlock(String evidenceId, TextEventAiResponse.Event event,
            Map<Integer, TextChange> sent) {
        return event.changeNos().stream().map(sent::get).anyMatch(change ->
                isAt(change.row().previous(), evidenceId) || isAt(change.row().current(), evidenceId));
    }

    private static boolean isAt(Side side, String evidenceId) {
        return side != null && side.blockNo() != null
                && DocumentBlock.evidenceId(side.rceptNo(), side.blockNo()).equals(evidenceId);
    }

    private static Side side(TextChange change, String side) {
        if (PREVIOUS.equals(side)) {
            return change.row().previous();
        }
        return CURRENT.equals(side) ? change.row().current() : null;
    }

    /** {@link #problem}이 null인 응답만 넘긴다 */
    static List<TextEventRow> rows(TextEventAiResponse response, Map<Integer, TextChange> sent) {
        return response.events().stream().map(event -> new TextEventRow(event.sortOrder(), event.title(),
                event.kind(), event.scaleAmount(), event.scaleAmountText(), event.currency(), event.scaleAmountKrw(),
                event.scaleRatio(), event.scaleNotComputedReason(), event.scaleEvidenceId(), event.amountSource(),
                event.fxSource(), event.fxRateDate() == null ? null : LocalDate.parse(event.fxRateDate()),
                event.sortBasis(), response.model(), response.promptVersion(), time(response.generatedAt()),
                event.changeNos().stream().sorted().toList(),
                quotes(event).stream().map(quote -> quote(quote, sent)).toList())).toList();
    }

    private static TextEventRow.Quote quote(TextEventAiResponse.Quote quote, Map<Integer, TextChange> sent) {
        Side side = side(sent.get(quote.changeNo()), quote.side());
        return new TextEventRow.Quote(quote.changeNo(), quote.purpose(), quote.side(), side.rceptNo(), side.sectionNo(),
                side.blockNo(), quote.text());
    }

    static List<Integer> unbound(TextEventAiResponse response) {
        return response.unboundChangeNos() == null ? List.of() : response.unboundChangeNos();
    }

    static List<LlmCallRow> calls(TextEventAiResponse response, String traceId) {
        if (response.calls() == null) {
            return List.of();
        }
        return response.calls().stream().filter(Objects::nonNull).map(call -> new LlmCallRow(
                call.task() == null ? TASK : call.task(), call.provider(), call.model(), call.promptVersion(),
                time(call.calledAt()), call.traceId() == null ? traceId : call.traceId(), call.inputTokens(),
                call.outputTokens(), call.latencyMs() == null ? 0 : call.latencyMs(),
                call.attempt() == null ? 1 : call.attempt(), call.outcome(), call.error())).toList();
    }

    private static List<TextEventAiResponse.Quote> quotes(TextEventAiResponse.Event event) {
        return event.quotes() == null ? List.of() : event.quotes();
    }

    private static LocalDateTime time(String value) {
        if (value == null) {
            return null;
        }
        try {
            return LocalDateTime.parse(value);
        } catch (DateTimeParseException e) {
            return null;
        }
    }
}
