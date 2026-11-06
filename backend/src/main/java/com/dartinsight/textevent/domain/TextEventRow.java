package com.dartinsight.textevent.domain;

import com.dartinsight.document.domain.DocumentBlock;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/**
 * 주요 사건 하나(text_event). 숫자는 ai-server의 코드가 공시에서 읽은 값이고, 사건끼리 더하지 않는다.
 *
 * @param changeNos     묶인 변경 번호(문서 순서)
 * @param signal        신호(event-4부터). event-3까지의 행은 null
 * @param factAccounts  사실 칸의 기준표 계정 이름. 값은 조회할 때 같은 분석의 재무 수치에서 찾는다
 * @param meaning       공시의 의미. event-3까지의 행은 null
 * @param signalReason  신호 이유. 만들지 않았으면(기준 없음·근거 미확인 보류) null
 */
public record TextEventRow(int sortOrder, String title, String kind, Long scaleAmount, String scaleAmountText,
        String currency, Long scaleAmountKrw, BigDecimal scaleRatio, String scaleNotComputedReason,
        String scaleEvidenceId, String amountSource, String fxSource, LocalDate fxRateDate, String sortBasis,
        String model, String promptVersion, LocalDateTime generatedAt, TextEventSignal signal,
        List<GlossaryTerm> glossary, List<FactAccount> factAccounts, List<Integer> changeNos, List<Quote> quotes,
        TextEventSentence meaning, TextEventSentence signalReason) {

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

    /** @param accountType 기준표가 투자 유형별로 계정을 나눈 종류만 유형 이름, 그 밖에는 null */
    public record FactAccount(String accountType, String accountName) {
    }

    /** 변경 연결·인용·문장을 붙인 사건 */
    public TextEventRow with(List<Integer> linkedChangeNos, List<Quote> linkedQuotes, TextEventSentence linkedMeaning,
            TextEventSentence linkedSignalReason) {
        return new TextEventRow(sortOrder, title, kind, scaleAmount, scaleAmountText, currency, scaleAmountKrw,
                scaleRatio, scaleNotComputedReason, scaleEvidenceId, amountSource, fxSource, fxRateDate, sortBasis,
                model, promptVersion, generatedAt, signal, glossary, factAccounts, List.copyOf(linkedChangeNos),
                List.copyOf(linkedQuotes), linkedMeaning, linkedSignalReason);
    }

    /** 그 신호의 사건인지. 신호가 없는 옛 행은 어느 신호에도 들지 않는다 */
    public boolean hasSignal(String expected) {
        return signal != null && expected.equals(signal.signal());
    }
}
