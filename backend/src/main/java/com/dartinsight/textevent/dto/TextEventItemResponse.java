package com.dartinsight.textevent.dto;

import com.dartinsight.analysis.domain.CalcStatus;
import com.dartinsight.analysis.domain.FinancialChange;
import com.dartinsight.analysis.domain.TextChange;
import com.dartinsight.analysis.domain.TextChangeListing;
import com.dartinsight.analysis.domain.TextChangeRow.Side;
import com.dartinsight.document.domain.DocumentBlock;
import com.dartinsight.textevent.domain.GlossaryTerm;
import com.dartinsight.textevent.domain.TextEvent;
import com.dartinsight.textevent.domain.TextEventFacts;
import com.dartinsight.textevent.domain.TextEventRow;
import com.dartinsight.textevent.domain.TextEventSentence;
import com.dartinsight.textevent.domain.TextEventSignal;
import com.dartinsight.textevent.domain.TextEventSignal.RowCounts;
import com.fasterxml.jackson.annotation.JsonInclude;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * 주요 사건 하나.
 *
 * @param signal      코드가 기준표로 붙인 신호(ADR-0060). AI가 정하지 않는다
 * @param facts       사실 칸. 같은 분석의 재무상태표 값을 그대로 쓴다
 * @param fields      묶인 변경이 속한 분야(분야 순서, 겹치지 않음)
 * @param aiGenerated 사건은 모두 AI가 묶은 것이라 코드가 항상 true로 넣는다
 */
public record TextEventItemResponse(long eventId, int sortOrder, String title, String kind, String kindCode,
        String changeCode, String changeName, String signal, String holdReason, String signalEvidenceId,
        RowCounts rowCounts, SentenceResponse meaning, SentenceResponse signalReason, List<GlossaryTerm> glossary,
        List<FactItem> facts, List<String> fields, List<Long> changeIds, List<QuoteItem> quotes, Long scaleAmount,
        String scaleAmountText, String currency, Long scaleAmountKrw, BigDecimal scaleRatio,
        String scaleNotComputedReason, String scaleEvidenceId, String amountSource, String fxSource,
        LocalDate fxRateDate, String sortBasis, boolean aiGenerated, String model, String promptVersion,
        LocalDateTime generatedAt) {

    /**
     * @param changes          변경 번호 → 변경. 사건에 묶인 변경이 모두 있어야 한다
     * @param financialChanges 같은 분석의 재무 수치
     */
    public static TextEventItemResponse of(TextEvent event, Map<Integer, TextChange> changes,
            List<FinancialChange> financialChanges) {
        TextEventRow row = event.row();
        TextEventSignal signal = row.signal();
        List<TextChange> linked = row.changeNos().stream().map(changes::get).toList();
        return new TextEventItemResponse(event.id(), row.sortOrder(), row.title(), row.kind(),
                signal == null ? null : signal.kindCode(), signal == null ? null : signal.changeCode(),
                signal == null ? null : signal.changeName(), signal == null ? null : signal.signal(),
                signal == null ? null : signal.holdReason(), signal == null ? null : signal.evidenceId(),
                signal == null ? null : signal.rowCounts(), SentenceResponse.of(row.meaning(), true, linked),
                SentenceResponse.of(row.signalReason(), false, linked), row.glossary(),
                TextEventFacts.match(row.factAccounts(), financialChanges).stream().map(FactItem::of).toList(),
                fields(linked), linked.stream().map(TextChange::id).toList(),
                row.quotes().stream().map(quote -> QuoteItem.of(quote, changes.get(quote.changeNo()))).toList(),
                row.scaleAmount(), row.scaleAmountText(), row.currency(), row.scaleAmountKrw(), row.scaleRatio(),
                row.scaleNotComputedReason(), row.scaleEvidenceId(), row.amountSource(), row.fxSource(),
                row.fxRateDate(), row.sortBasis(), true, row.model(), row.promptVersion(), row.generatedAt());
    }

    private static List<String> fields(List<TextChange> linked) {
        List<String> found = linked.stream()
                .map(change -> change.row().listing())
                .filter(Objects::nonNull)
                .map(TextChangeListing::field)
                .filter(Objects::nonNull)
                .toList();
        return TextChangeListing.FIELDS.stream().filter(found::contains).toList();
    }

    public record QuoteItem(long changeId, String purpose, String side, String text, String evidenceId,
            String sectionPath) {

        static QuoteItem of(TextEventRow.Quote quote, TextChange change) {
            return new QuoteItem(change.id(), quote.purpose(), quote.side(), quote.text(), quote.evidenceId(),
                    change.row().sectionPath());
        }
    }

    /**
     * 사건 문장 칸(공시의 의미, 신호 이유).
     *
     * @param aiGenerated GENERATED면 true. 대체 표시·실패는 코드 문구라 false
     */
    public record SentenceResponse(String status, String failReason, boolean aiGenerated,
            List<SentenceItem> items, String model, String promptVersion, LocalDateTime generatedAt) {

        /** 만들지 않은 칸은 null. absentTopics는 공시의 의미에만 넣는다 */
        static SentenceResponse of(TextEventSentence sentence, boolean withTopics, List<TextChange> linked) {
            if (sentence == null) {
                return null;
            }
            return new SentenceResponse(sentence.status(), sentence.failReason(), sentence.aiGenerated(),
                    sentence.items().stream().map(item -> new SentenceItem(item.type(),
                            withTopics ? item.absentTopics() : null, item.text(),
                            item.evidenceIds().stream().map(id -> new Evidence(id, sectionPath(id, linked))).toList()))
                            .toList(),
                    sentence.model(), sentence.promptVersion(), sentence.generatedAt());
        }

        /** 근거 블록이 속한 변경의 섹션 경로. 찾지 못하면 null */
        private static String sectionPath(String evidenceId, List<TextChange> linked) {
            return linked.stream().filter(change -> isAt(change.row().previous(), evidenceId)
                    || isAt(change.row().current(), evidenceId))
                    .map(change -> change.row().sectionPath()).findFirst().orElse(null);
        }

        private static boolean isAt(Side side, String evidenceId) {
            return side != null && side.blockNo() != null
                    && DocumentBlock.evidenceId(side.rceptNo(), side.blockNo()).equals(evidenceId);
        }
    }

    /** @param absentTopics 공시의 의미에만 있다. 신호 이유에는 필드가 없다 */
    public record SentenceItem(String type, @JsonInclude(JsonInclude.Include.NON_NULL) List<String> absentTopics,
            String text, List<Evidence> evidence) {
    }

    public record Evidence(String evidenceId, String sectionPath) {
    }

    /** 사실 칸 하나. 값은 GET .../financial-changes의 같은 항목과 같다 */
    public record FactItem(String accountType, Long changeId, String sjDiv, String accountName, Long previousAmount,
            Long currentAmount, Long changeAmount, BigDecimal changeRate, CalcStatus calcStatus, String currency) {

        static FactItem of(TextEventFacts.Fact fact) {
            FinancialChange change = fact.change();
            return new FactItem(fact.accountType(), change.getId(), change.getSjDiv(), change.getAccountName(),
                    change.getPreviousAmount(), change.getCurrentAmount(), change.getChangeAmount(),
                    change.getChangeRate(), change.getCalcStatus(), change.getCurrency());
        }
    }
}
