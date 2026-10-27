package com.dartinsight.disclosure.dto;

import com.dartinsight.disclosure.domain.DisclosureKeyItems;
import com.dartinsight.disclosure.domain.KeyItem;
import com.dartinsight.disclosure.domain.KeyItemKind;
import com.dartinsight.disclosure.domain.KeyItemStatus;
import com.dartinsight.report.domain.DartLinks;
import com.fasterxml.jackson.annotation.JsonFormat;
import java.time.LocalDateTime;
import java.util.List;

/**
 * 주요사항보고서 핵심 수치 응답(docs/api-spec.md GET /api/companies/{corpCode}/disclosures/{rceptNo}/key-items).
 *
 * @param sourceRceptNo 값을 가져온 공시의 접수번호가 요청한 접수번호와 다를 때 그 접수번호(비고 '정'인 원본이 최신 정정본 행을
 *                      씀). 같으면 null
 * @param sourceUrl     값을 가져온 공시의 DART 공시뷰어 주소(sourceRceptNo가 있으면 그 접수번호)
 */
public record DisclosureKeyItemsResponse(
        String rceptNo,
        KeyItemKind kind,
        String kindLabel,
        KeyItemStatus status,
        List<Item> items,
        String sourceRceptNo,
        String sourceUrl,
        @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss") LocalDateTime fetchedAt) {

    /** @param unit 개발가이드의 단위. 없으면 null */
    public record Item(String field, String label, String value, String unit) {

        static Item from(KeyItem item) {
            return new Item(item.field(), item.label(), item.value(), item.unit());
        }
    }

    public static DisclosureKeyItemsResponse from(DisclosureKeyItems keyItems) {
        return new DisclosureKeyItemsResponse(
                keyItems.rceptNo(),
                keyItems.kind(),
                keyItems.kind().label(),
                keyItems.status(),
                keyItems.items().stream().map(Item::from).toList(),
                keyItems.sourceRceptNo(),
                DartLinks.viewer(keyItems.sourceRceptNo() == null ? keyItems.rceptNo() : keyItems.sourceRceptNo()),
                keyItems.fetchedAt());
    }
}
