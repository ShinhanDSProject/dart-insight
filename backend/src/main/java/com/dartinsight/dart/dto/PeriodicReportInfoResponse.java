package com.dartinsight.dart.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.util.List;

/**
 * OpenDART 정기보고서 주요정보(DS002) 응답의 공통 모양. 항목 모양은 API마다 다르다.
 *
 * @param <T> {@link MajorShareholderItem}, {@link ExecutiveItem}, {@link DividendItem}
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record PeriodicReportInfoResponse<T>(String status, String message, List<T> list)
        implements OpenDartStatus {
}
