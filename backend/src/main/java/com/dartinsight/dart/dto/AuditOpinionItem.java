package com.dartinsight.dart.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * 회계감사인의 명칭 및 감사의견(accnutAdtorNmNdAdtOpinion.json) 한 줄. 값은 원문 문자열이다.
 * https://opendart.fss.or.kr/guide/detail.do?apiGrpCd=DS002&apiId=2020009
 *
 * @param term            사업연도(bsns_year). 기수와 당기·전기·전전기, 예 "제60기\n(당기)"
 * @param auditor         감사인(adtor)
 * @param opinion         감사의견(adt_opinion), 예 "적정의견", "의견거절"
 * @param specialMatter   감사보고서 특기사항(adt_reprt_spcmnt_matter). 2019-12-08까지 쓰던 필드
 * @param emphasisMatter  강조사항 등(emphs_matter). 2019-12-09에 더해진 필드
 * @param keyAuditMatter  핵심감사사항(core_adt_matter). 2019-12-09에 더해진 필드
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record AuditOpinionItem(
        @JsonProperty("rcept_no") String rceptNo,
        @JsonProperty("bsns_year") String term,
        @JsonProperty("adtor") String auditor,
        @JsonProperty("adt_opinion") String opinion,
        @JsonProperty("adt_reprt_spcmnt_matter") String specialMatter,
        @JsonProperty("emphs_matter") String emphasisMatter,
        @JsonProperty("core_adt_matter") String keyAuditMatter,
        @JsonProperty("stlm_dt") String settlementDate) {
}
