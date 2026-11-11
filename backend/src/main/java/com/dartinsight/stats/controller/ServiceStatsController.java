package com.dartinsight.stats.controller;

import com.dartinsight.common.web.ApiPaths;
import com.dartinsight.stats.dto.ServiceStatsResponse;
import com.dartinsight.stats.service.ServiceStatsService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 첫 화면 숫자 줄 API(docs/api-spec.md, #866). 로그인 없이 쓴다. */
@RestController
@RequestMapping(ApiPaths.STATS)
@RequiredArgsConstructor
public class ServiceStatsController {

    private final ServiceStatsService serviceStatsService;

    @GetMapping
    public ServiceStatsResponse current() {
        return ServiceStatsResponse.from(serviceStatsService.current());
    }
}
