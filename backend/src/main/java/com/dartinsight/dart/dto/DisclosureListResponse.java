package com.dartinsight.dart.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;

/**
 * OpenDART 공시검색(list.json) 응답.
 * https://opendart.fss.or.kr/guide/detail.do?apiGrpCd=DS001&apiId=2019001
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record DisclosureListResponse(
        String status,
        String message,
        @JsonProperty("page_no") Integer pageNo,
        @JsonProperty("page_count") Integer pageCount,
        @JsonProperty("total_count") Integer totalCount,
        @JsonProperty("total_page") Integer totalPage,
        List<Item> list) {

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Item(
            @JsonProperty("corp_code") String corpCode,
            @JsonProperty("corp_name") String corpName,
            @JsonProperty("stock_code") String stockCode,
            @JsonProperty("corp_cls") String corpCls,
            @JsonProperty("report_nm") String reportName,
            @JsonProperty("rcept_no") String rceptNo,
            @JsonProperty("flr_nm") String filerName,
            @JsonProperty("rcept_dt") String rceptDt,
            @JsonProperty("rm") String remark) {
    }
}
