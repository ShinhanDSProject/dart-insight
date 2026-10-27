package com.dartinsight.relateddisclosure.domain;

import java.util.List;

/**
 * 분석 하나의 관련 수시공시 계산 결과.
 *
 * @param run     계산 기록. partial이면 저장하지 않아 id가 null
 * @param links   변경 순서, 같은 변경 안에서는 접수일·접수번호 순서
 * @param cached  저장돼 있던 결과를 읽었으면 true, 이번 요청에서 계산했으면 false
 * @param partial 주요정보(DS005)를 받지 못해 2단계 판정을 하지 못했으면 true(1단계 결과만, 저장하지 않음)
 */
public record RelatedDisclosures(RelatedRun run, List<RelatedLink> links, boolean cached, boolean partial) {

    public RelatedDisclosures {
        links = List.copyOf(links);
    }

    /** 문장 변경 하나(변경 번호)의 연결 */
    public List<RelatedLink> linksOf(int changeNo) {
        return links.stream().filter(link -> link.changeNo() == changeNo).toList();
    }
}
