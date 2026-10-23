package com.dartinsight.system;

import com.dartinsight.aiserver.client.AiServerClient.AiServerStatus;

public record SystemHealthResponse(String backend, AiServerStatus aiServer) {
}
