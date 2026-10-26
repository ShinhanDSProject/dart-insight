package com.dartinsight.dart.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * 임원 현황(exctvSttus.json) 한 줄. 성별·출생 연월·주요 경력은 쓰지 않아 읽지 않는다.
 * https://opendart.fss.or.kr/guide/detail.do?apiGrpCd=DS002&apiId=2019010
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record ExecutiveItem(
        @JsonProperty("rcept_no") String rceptNo,
        @JsonProperty("nm") String name,
        @JsonProperty("ofcps") String position,
        @JsonProperty("rgist_exctv_at") String registeredType,
        @JsonProperty("fte_at") String fullTime,
        @JsonProperty("chrg_job") String duty,
        @JsonProperty("mxmm_shrholdr_relate") String largestShareholderRelation,
        @JsonProperty("hffc_pd") String tenure,
        @JsonProperty("tenure_end_on") String termEnd,
        @JsonProperty("stlm_dt") String settlementDate) {
}
