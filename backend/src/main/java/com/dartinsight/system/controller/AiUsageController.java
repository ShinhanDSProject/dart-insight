package com.dartinsight.system.controller;

import com.dartinsight.common.web.ApiPaths;
import com.dartinsight.system.dto.AiUsageResponse;
import com.dartinsight.system.service.AiUsageService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * AI 사용 현황(docs/api-spec.md GET /api/system/ai-usage, FS-15). 집계만 돌려준다.
 */
@RestController
@RequestMapping(ApiPaths.SYSTEM)
@RequiredArgsConstructor
public class AiUsageController {

    private final AiUsageService aiUsageService;

    @GetMapping(ApiPaths.AI_USAGE)
    public AiUsageResponse usage(@RequestParam(defaultValue = "30") int days) {
        return aiUsageService.usage(days);
    }
}
