package com.dartinsight.disclosure.domain;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 사업보고서 한 건의 감사의견을 받은 결과(disclosure_audit_opinion 한 행).
 *
 * @param rceptNo       사업보고서 접수번호(최근 공시 목록의 것)
 * @param available     자료가 있는지. false면 NO_DATA(013이거나 쓸 행이 없음)이고 rows는 비어 있다
 * @param sourceRceptNo 응답 행의 접수번호가 rceptNo와 다를 때(뒤에 나온 정정본) 그 접수번호. 같으면 null
 * @param rows          같은 행은 한 번만 둔 행 목록
 * @param fetchedAt     받은 시각
 */
public record AuditOpinions(String rceptNo, boolean available, String sourceRceptNo, List<AuditOpinionRow> rows,
        LocalDateTime fetchedAt) {
}
