package com.dartinsight.dart.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * 최대주주 현황(hyslrSttus.json) 한 줄. 값은 원문 문자열이다.
 * https://opendart.fss.or.kr/guide/detail.do?apiGrpCd=DS002&apiId=2019007
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record MajorShareholderItem(
        @JsonProperty("rcept_no") String rceptNo,
        @JsonProperty("nm") String name,
        @JsonProperty("relate") String relation,
        @JsonProperty("stock_knd") String stockKind,
        @JsonProperty("bsis_posesn_stock_co") String beginShares,
        @JsonProperty("bsis_posesn_stock_qota_rt") String beginRatio,
        @JsonProperty("trmend_posesn_stock_co") String endShares,
        @JsonProperty("trmend_posesn_stock_qota_rt") String endRatio,
        @JsonProperty("rm") String remark,
        @JsonProperty("stlm_dt") String settlementDate) {
}
