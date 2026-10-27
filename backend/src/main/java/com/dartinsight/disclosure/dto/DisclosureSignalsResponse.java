package com.dartinsight.disclosure.dto;

import com.dartinsight.disclosure.domain.DisclosureSignal;
import com.dartinsight.disclosure.domain.DisclosureSignalKind;
import com.dartinsight.disclosure.domain.DisclosureSignalStatus;
import com.dartinsight.disclosure.service.DisclosureSignalService.DisclosureSignals;
import com.dartinsight.report.domain.DartLinks;
import java.time.LocalDate;
import java.util.Arrays;
import java.util.List;

/**
 * 확인해 볼 공시 응답(docs/api-spec.md GET /api/companies/{corpCode}/disclosure-signals).
 *
 * @param kinds 모든 종류를 정해진 순서로 넣는다(0건·확인하지 못함 포함)
 * @param items 접수일이 최근인 순서
 */
public record DisclosureSignalsResponse(
        String corpCode,
        LocalDate from,
        LocalDate to,
        List<KindCount> kinds,
        List<Item> items) {

    /** @param count UNAVAILABLE이면 null */
    public record KindCount(DisclosureSignalKind kind, String label, DisclosureSignalStatus status, Integer count) {
    }

    public record Item(DisclosureSignalKind kind, String rceptNo, String reportName, LocalDate receivedDate,
            String sentence, String dartUrl) {

        static Item from(DisclosureSignal signal) {
            return new Item(signal.kind(), signal.disclosure().rceptNo(), signal.disclosure().displayName(),
                    signal.disclosure().rceptDt(), signal.sentence(), DartLinks.viewer(signal.disclosure().rceptNo()));
        }
    }

    public static DisclosureSignalsResponse from(DisclosureSignals signals) {
        return new DisclosureSignalsResponse(
                signals.corpCode(),
                signals.from(),
                signals.to(),
                Arrays.stream(DisclosureSignalKind.values())
                        .map(k -> new KindCount(k, k.label(), signals.statuses().get(k), signals.counts().get(k)))
                        .toList(),
                signals.items().stream().map(Item::from).toList());
    }
}
