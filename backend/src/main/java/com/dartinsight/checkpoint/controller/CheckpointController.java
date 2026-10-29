package com.dartinsight.checkpoint.controller;

import com.dartinsight.checkpoint.dto.CompanyCheckpointsResponse;
import com.dartinsight.checkpoint.service.CheckpointService;
import com.dartinsight.common.web.ApiPaths;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 재무 체크 포인트 API(docs/api-spec.md GET /api/companies/{corpCode}/checkpoints, FS-62). 기업 화면 개요 탭. */
@RestController
@RequestMapping(ApiPaths.COMPANY_CHECKPOINTS)
@RequiredArgsConstructor
public class CheckpointController {

    private final CheckpointService checkpointService;

    @GetMapping
    public CompanyCheckpointsResponse get(@PathVariable String corpCode) {
        return CompanyCheckpointsResponse.from(checkpointService.get(corpCode));
    }
}
