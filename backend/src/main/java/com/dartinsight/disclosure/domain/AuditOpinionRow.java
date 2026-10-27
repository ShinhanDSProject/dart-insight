package com.dartinsight.disclosure.domain;

/**
 * 감사의견 응답 한 줄을 정리한 값(disclosure_audit_opinion.rows_json의 한 칸). 원문 값에서 앞뒤 공백만 빼고, '-'·빈 값은 null.
 *
 * @param term    사업연도(bsns_year)의 공백을 모두 뺀 값, 예 "제60기(당기)"
 * @param auditor 감사인(adtor)
 * @param opinion 감사의견(adt_opinion)
 */
public record AuditOpinionRow(String term, String auditor, String opinion) {
}
