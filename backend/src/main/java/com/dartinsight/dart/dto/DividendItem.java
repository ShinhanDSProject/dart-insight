package com.dartinsight.dart.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * 배당에 관한 사항(alotMatter.json) 한 줄. 당기·전기·전전기 값은 원문 문자열이다(단위는 구분 se에 적혀 있음).
 * https://opendart.fss.or.kr/guide/detail.do?apiGrpCd=DS002&apiId=2019005
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record DividendItem(
        @JsonProperty("rcept_no") String rceptNo,
        @JsonProperty("se") String category,
        @JsonProperty("stock_knd") String stockKind,
        @JsonProperty("thstrm") String currentTerm,
        @JsonProperty("frmtrm") String priorTerm,
        @JsonProperty("lwfr") String twoTermsAgo,
        @JsonProperty("stlm_dt") String settlementDate) {
}
