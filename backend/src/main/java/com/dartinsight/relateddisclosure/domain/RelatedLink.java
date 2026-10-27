package com.dartinsight.relateddisclosure.domain;

/**
 * 문장 변경과 수시공시의 연결 한 건(related_disclosure 한 행).
 *
 * @param changeNo      분석 안의 변경 순서(text_change.change_no)
 * @param disclosure    연결한 공시(저장된 disclosure_window_item)
 * @param latestRceptNo 링크로 열 최신 정정본 접수번호. 모르면 null(#341에서 채움)
 * @param matchRule     걸린 규칙 키(여러 개면 규칙 순서의 첫 규칙)
 * @param matchedFields STRONG일 때 일치한 값 종류(쉼표로 이음). 아니면 null
 */
public record RelatedLink(int changeNo, WindowDisclosure disclosure, String latestRceptNo, DisclosureTiming timing,
        String matchRule, MatchLevel matchLevel, String matchedFields) {
}
