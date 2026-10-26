package com.dartinsight.relateddisclosure.domain;

import java.util.List;

/**
 * 기간 공시 목록을 받은 기록과 받은 공시들.
 *
 * @param items 접수일이 이른 순서, 같은 날이면 접수번호 순서
 */
public record WindowDisclosures(WindowFetch fetch, List<WindowDisclosure> items) {

    public WindowDisclosures {
        items = List.copyOf(items);
    }
}
