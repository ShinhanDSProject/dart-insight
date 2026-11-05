package com.dartinsight.textevent.domain;

import com.dartinsight.document.domain.DocumentBlock;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/**
 * 주요 사건 하나(text_event). 숫자는 ai-server의 코드가 공시에서 읽은 값이고, 사건끼리 더하지 않는다.
 *
 * @param changeNos 묶인 변경 번호(문서 순서)
 */
public record TextEventRow(int sortOrder, String title, String kind, Long scaleAmount, String scaleAmountText,
        String currency, Long scaleAmountKrw, BigDecimal scaleRatio, String scaleNotComputedReason,
        String scaleEvidenceId, String amountSource, String fxSource, LocalDate fxRateDate, String sortBasis,
        String model, String promptVersion, LocalDateTime generatedAt, List<Integer> changeNos, List<Quote> quotes) {

    /**
     * 사건의 인용과 근거 위치(text_event_quote).
     *
     * @param purpose CHANGE, REASON
     * @param side    PREVIOUS, CURRENT
     */
    public record Quote(int changeNo, String purpose, String side, String rceptNo, Integer sectionNo, int blockNo,
            String text) {

        public String evidenceId() {
            return DocumentBlock.evidenceId(rceptNo, blockNo);
        }
    }

    /** 변경 연결과 인용을 붙인 사건 */
    public TextEventRow with(List<Integer> linkedChangeNos, List<Quote> linkedQuotes) {
        return new TextEventRow(sortOrder, title, kind, scaleAmount, scaleAmountText, currency, scaleAmountKrw,
                scaleRatio, scaleNotComputedReason, scaleEvidenceId, amountSource, fxSource, fxRateDate, sortBasis,
                model, promptVersion, generatedAt, List.copyOf(linkedChangeNos), List.copyOf(linkedQuotes));
    }
}
