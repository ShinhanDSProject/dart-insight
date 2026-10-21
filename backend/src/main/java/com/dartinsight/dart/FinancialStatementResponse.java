package com.dartinsight.dart;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;

/**
 * OpenDART 단일회사 전체 재무제표(fnlttSinglAcntAll.json) 응답. 금액은 문자열로 온다.
 * https://opendart.fss.or.kr/guide/detail.do?apiGrpCd=DS003&apiId=2019020
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record FinancialStatementResponse(String status, String message, List<Item> list) {

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Item(
            @JsonProperty("rcept_no") String rceptNo,
            @JsonProperty("reprt_code") String reprtCode,
            @JsonProperty("bsns_year") String bsnsYear,
            @JsonProperty("corp_code") String corpCode,
            @JsonProperty("sj_div") String sjDiv,
            @JsonProperty("sj_nm") String sjName,
            @JsonProperty("account_id") String accountId,
            @JsonProperty("account_nm") String accountName,
            @JsonProperty("account_detail") String accountDetail,
            @JsonProperty("thstrm_nm") String thstrmName,
            @JsonProperty("thstrm_amount") String thstrmAmount,
            @JsonProperty("thstrm_add_amount") String thstrmAddAmount,
            @JsonProperty("frmtrm_nm") String frmtrmName,
            @JsonProperty("frmtrm_amount") String frmtrmAmount,
            @JsonProperty("frmtrm_q_amount") String frmtrmQAmount,
            @JsonProperty("frmtrm_add_amount") String frmtrmAddAmount,
            @JsonProperty("ord") String ord,
            @JsonProperty("currency") String currency) {
    }
}
