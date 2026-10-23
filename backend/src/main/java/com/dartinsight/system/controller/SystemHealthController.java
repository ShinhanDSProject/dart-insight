package com.dartinsight.system.controller;

import com.dartinsight.aiserver.client.AiServerClient;
import com.dartinsight.common.web.ApiPaths;
import com.dartinsight.system.dto.SystemHealthResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 서비스 연결 상태. AI 서버가 응답하지 않아도 200으로 DOWN을 알려 준다.
 */
@RestController
@RequestMapping(ApiPaths.SYSTEM)
@RequiredArgsConstructor
public class SystemHealthController {

    private final AiServerClient aiServerClient;

    @GetMapping(ApiPaths.HEALTH)
    public SystemHealthResponse health() {
        return new SystemHealthResponse("UP", aiServerClient.health());
    }
}
