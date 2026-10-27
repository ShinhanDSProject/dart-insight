package com.dartinsight.disclosure.domain;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 공시 한 건의 핵심 수치(disclosure_key_item 한 행).
 *
 * @param items         NO_DATA면 빈 목록
 * @param fetchedAt     OpenDART에서 받은 시각
 * @param sourceRceptNo 응답 행의 접수번호가 rceptNo와 다를 때 그 접수번호(기간 뒤 정정 원본의 최신 정정본, 3.6). 같으면 null
 */
public record DisclosureKeyItems(String rceptNo, KeyItemKind kind, KeyItemStatus status, List<KeyItem> items,
        LocalDateTime fetchedAt, String sourceRceptNo) {

    public DisclosureKeyItems {
        items = List.copyOf(items);
    }
}
