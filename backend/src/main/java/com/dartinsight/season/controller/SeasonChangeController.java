package com.dartinsight.season.controller;

import com.dartinsight.common.error.ApiException;
import com.dartinsight.common.web.ApiPaths;
import com.dartinsight.report.domain.ReportType;
import com.dartinsight.season.domain.Season;
import com.dartinsight.season.dto.SeasonChangeListResponse;
import com.dartinsight.season.service.SeasonChangeService;
import java.util.Arrays;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** 첫 화면 이번 시즌 변화가 큰 기업 Top 10(1.7, #420). 저장된 순위만 읽는다 */
@RestController
@RequestMapping(ApiPaths.SEASON_CHANGES)
@RequiredArgsConstructor
public class SeasonChangeController {

    private static final int TOP = 10;

    private final SeasonChangeService seasonChangeService;

    @GetMapping
    public SeasonChangeListResponse list(@RequestParam(required = false) String reportType,
            @RequestParam(required = false) Integer fiscalYear) {
        return seasonChangeService.view(season(reportType, fiscalYear), TOP)
                .map(SeasonChangeListResponse::from)
                .orElseGet(SeasonChangeListResponse::empty);
    }

    /** 둘 다 없으면 null(가장 최근 시즌). 하나만 있거나 종류가 맞지 않으면 400 */
    private static Season season(String reportType, Integer fiscalYear) {
        if (reportType == null && fiscalYear == null) {
            return null;
        }
        if (reportType == null || fiscalYear == null) {
            throw ApiException.invalidInput(reportType == null ? "reportType" : "fiscalYear",
                    "reportType과 fiscalYear를 함께 주세요.");
        }
        ReportType type = Arrays.stream(ReportType.values()).filter(t -> t.name().equals(reportType)).findFirst()
                .orElseThrow(() -> ApiException.invalidInput("reportType", "Q1, HALF, Q3, ANNUAL 중 하나여야 합니다."));
        return new Season(type, fiscalYear);
    }
}
