package com.dartinsight.relateddisclosure.domain;

import java.util.List;

/**
 * 분석 하나의 관련 수시공시 계산 결과.
 *
 * @param links  변경 순서, 같은 변경 안에서는 접수일·접수번호 순서
 * @param cached 저장돼 있던 결과를 읽었으면 true, 이번 요청에서 계산했으면 false
 */
public record RelatedDisclosures(RelatedRun run, List<RelatedLink> links, boolean cached) {

    public RelatedDisclosures {
        links = List.copyOf(links);
    }
}
