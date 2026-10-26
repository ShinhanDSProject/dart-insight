package com.dartinsight.dart.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;

/**
 * OpenDART 단일회사 주요계정(fnlttSinglAcnt.json) 응답. 금액은 쉼표가 든 문자열로 온다.
 * 한 응답에 연결(fs_div CFS)·별도(OFS) 줄이 함께 있다.
 * 분·반기 손익의 thstrm_amount는 3개월 금액, thstrm_add_amount는 누적 금액이다(실제 응답으로 확인).
 * https://opendart.fss.or.kr/guide/detail.do?apiGrpCd=DS003&apiId=2019016
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record KeyAccountResponse(String status, String message, List<Item> list) {

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Item(
            @JsonProperty("rcept_no") String rceptNo,
            @JsonProperty("bsns_year") String bsnsYear,
            @JsonProperty("reprt_code") String reprtCode,
            @JsonProperty("account_nm") String accountName,
            @JsonProperty("fs_div") String fsDiv,
            @JsonProperty("sj_div") String sjDiv,
            @JsonProperty("thstrm_amount") String thstrmAmount,
            @JsonProperty("thstrm_add_amount") String thstrmAddAmount,
            @JsonProperty("ord") String ord,
            @JsonProperty("currency") String currency) {
    }
}
