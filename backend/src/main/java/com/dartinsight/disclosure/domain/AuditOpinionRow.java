package com.dartinsight.disclosure.domain;

/**
 * 감사의견 응답 한 줄을 정리한 값(disclosure_audit_opinion.rows_json의 한 칸). 원문 값에서 앞뒤 공백만 빼고, '-'·빈 값은 null.
 *
 * @param term           사업연도(bsns_year)의 공백을 모두 뺀 값, 예 "제60기(당기)"
 * @param auditor        감사인(adtor)
 * @param opinion        감사의견(adt_opinion)
 * @param emphasisMatter 강조사항 등(emphs_matter, 2019-12-09부터)
 * @param specialMatter  감사보고서 특기사항(adt_reprt_spcmnt_matter, 2019-12-08까지)
 * @param keyAuditMatter 핵심감사사항(core_adt_matter). 저장만 하고 아직 쓰지 않는다
 */
public record AuditOpinionRow(String term, String auditor, String opinion, String emphasisMatter,
        String specialMatter, String keyAuditMatter) {

    /** 강조사항·특기사항·핵심감사사항이 없는 행 */
    public AuditOpinionRow(String term, String auditor, String opinion) {
        this(term, auditor, opinion, null, null, null);
    }
}
