package com.dartinsight.disclosure.domain;

import com.dartinsight.disclosure.domain.DisclosureSignalRules.GoingConcernNote;

/**
 * 사업보고서 한 건의 감사의견 자료에서 찾은 계속기업 문구(#546). 확인해 볼 공시의 종류는 아니고 재무 체크 포인트가 쓴다.
 *
 * @param disclosure 공시 목록의 사업보고서
 * @param rceptNo    근거 접수번호(감사의견 응답 행의 접수번호. 정정본이면 그 접수번호)
 */
public record GoingConcernFinding(Disclosure disclosure, String rceptNo, GoingConcernNote note) {
}
