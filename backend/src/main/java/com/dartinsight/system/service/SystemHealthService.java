package com.dartinsight.system.service;

import com.dartinsight.aiserver.client.AiServerClient;
import com.dartinsight.system.dto.SystemHealthResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * 서비스 연결 상태. backend는 이 응답을 만들 수 있으면 UP이고, AI 서버는 health 호출 결과를 그대로 쓴다.
 */
@Service
@RequiredArgsConstructor
public class SystemHealthService {

    private final AiServerClient aiServerClient;

    public SystemHealthResponse health() {
        return new SystemHealthResponse("UP", aiServerClient.health());
    }
}
