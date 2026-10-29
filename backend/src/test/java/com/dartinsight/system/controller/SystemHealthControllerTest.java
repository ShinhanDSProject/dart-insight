package com.dartinsight.system.controller;

import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest(properties = {
        // 아무것도 듣지 않는 포트: AI 서버가 꺼진 상황
        "app.ai-server.base-url=http://127.0.0.1:1",
        "app.ai-server.connect-timeout=300ms",
        "app.ai-server.read-timeout=300ms"
})
@AutoConfigureMockMvc
class SystemHealthControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void reportsAiServerDownWith200() throws Exception {
        mockMvc.perform(get("/api/system/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.backend").value("UP"))
                .andExpect(jsonPath("$.aiServer").value("DOWN"));
    }

    @Test
    void allowsFrontendOriginWithCors() throws Exception {
        mockMvc.perform(get("/api/system/health").header("Origin", "http://localhost:5173"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", "http://localhost:5173"));
    }

    @Test
    @DisplayName("화면이 다른 출처에서 PATCH(커뮤니티 글 고치기)를 보낼 수 있게 사전 요청을 허용한다")
    void allowsPatchPreflight() throws Exception {
        mockMvc.perform(options("/api/posts/1")
                        .header("Origin", "http://localhost:5173")
                        .header("Access-Control-Request-Method", "PATCH"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Methods", containsString("PATCH")));
    }
}
