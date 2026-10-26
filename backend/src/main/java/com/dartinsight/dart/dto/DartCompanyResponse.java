package com.dartinsight.dart.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * OpenDART 기업개황(company.json) 응답. 쓰지 않는 필드(jurir_no·bizr_no·fax_no)는 받지 않는다.
 * https://opendart.fss.or.kr/guide/detail.do?apiGrpCd=DS001&apiId=2019002
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record DartCompanyResponse(
        String status,
        String message,
        @JsonProperty("corp_name") String corpName,
        @JsonProperty("corp_name_eng") String corpNameEng,
        @JsonProperty("stock_name") String stockName,
        @JsonProperty("stock_code") String stockCode,
        @JsonProperty("ceo_nm") String ceoNm,
        @JsonProperty("corp_cls") String corpCls,
        @JsonProperty("induty_code") String indutyCode,
        @JsonProperty("est_dt") String estDt,
        @JsonProperty("acc_mt") String accMt,
        @JsonProperty("hm_url") String hmUrl,
        @JsonProperty("ir_url") String irUrl,
        @JsonProperty("adres") String adres,
        @JsonProperty("phn_no") String phnNo) implements OpenDartStatus {
}
