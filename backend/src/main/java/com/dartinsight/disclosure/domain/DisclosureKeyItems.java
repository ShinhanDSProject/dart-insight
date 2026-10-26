package com.dartinsight.disclosure.domain;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 공시 한 건의 핵심 수치(disclosure_key_item 한 행).
 *
 * @param items     NO_DATA면 빈 목록
 * @param fetchedAt OpenDART에서 받은 시각
 */
public record DisclosureKeyItems(String rceptNo, KeyItemKind kind, KeyItemStatus status, List<KeyItem> items,
        LocalDateTime fetchedAt) {

    public DisclosureKeyItems {
        items = List.copyOf(items);
    }
}
