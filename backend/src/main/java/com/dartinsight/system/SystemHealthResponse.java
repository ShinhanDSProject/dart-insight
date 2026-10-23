package com.dartinsight.system;

import com.dartinsight.aiserver.AiServerClient.AiServerStatus;

public record SystemHealthResponse(String backend, AiServerStatus aiServer) {
}
