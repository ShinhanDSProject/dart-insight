package com.dartinsight.system.dto;

import com.dartinsight.aiserver.client.AiServerClient.AiServerStatus;

public record SystemHealthResponse(String backend, AiServerStatus aiServer) {
}
