package com.dartinsight.system;

import com.dartinsight.aiserver.AiServerClient;
import com.dartinsight.common.web.ApiPaths;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 서비스 연결 상태. AI 서버가 응답하지 않아도 200으로 DOWN을 알려 준다.
 */
@RestController
@RequestMapping(ApiPaths.SYSTEM)
public class SystemHealthController {

    private final AiServerClient aiServerClient;

    public SystemHealthController(AiServerClient aiServerClient) {
        this.aiServerClient = aiServerClient;
    }

    @GetMapping(ApiPaths.HEALTH)
    public SystemHealthResponse health() {
        return new SystemHealthResponse("UP", aiServerClient.health());
    }
}
