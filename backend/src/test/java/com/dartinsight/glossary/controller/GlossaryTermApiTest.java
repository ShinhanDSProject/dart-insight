package com.dartinsight.glossary.controller;

import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest(properties = "app.glossary.location=classpath:glossary/test-terms.json")
@AutoConfigureMockMvc
class GlossaryTermApiTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    @DisplayName("출처·검토일이 있는 카드만 명세 모양으로 돌려준다(로그인 없이)")
    void listsOnlyReviewedCardsInSpecShape() throws Exception {
        mockMvc.perform(get("/api/glossary-terms"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items", hasSize(2)))
                .andExpect(jsonPath("$.items[*].key", contains("debtRatio", "asset")))
                .andExpect(jsonPath("$.items[0].level").value("CORE"))
                .andExpect(jsonPath("$.items[0].term").value("부채비율"))
                .andExpect(jsonPath("$.items[0].aliases", contains("부채 비율")))
                .andExpect(jsonPath("$.items[0].definition").value("부채총계를 자본총계로 나눈 비율이에요."))
                .andExpect(jsonPath("$.items[0].example").value("자본총계가 100원이고 부채총계가 30원이면 부채비율은 30%예요."))
                .andExpect(jsonPath("$.items[0].whereToCheck").value("재무상태표의 부채총계와 자본총계"))
                .andExpect(jsonPath("$.items[0].noJudgment").value("이 숫자 하나로 좋고 나쁨을 정하지 않아요."))
                // 검토 전 카드(capitalImpairment)는 관련 용어에서도 뺀다
                .andExpect(jsonPath("$.items[0].related", contains("asset")))
                .andExpect(jsonPath("$.items[0].sources[0].title").value("테스트 공식 자료"))
                .andExpect(jsonPath("$.items[0].sources[0].url").value("https://example.test/debt-ratio"))
                .andExpect(jsonPath("$.items[0].reviewedAt").value("2026-11-10"))
                // 검토자와 '이 회사 값을 찾을 곳'은 내보내지 않는다
                .andExpect(jsonPath("$.items[0].reviewer").doesNotExist())
                .andExpect(jsonPath("$.items[0].companyValue").doesNotExist())
                .andExpect(jsonPath("$.items[1].level").value("BASIC"))
                .andExpect(jsonPath("$.items[1].example", nullValue()))
                .andExpect(jsonPath("$.items[1].related", hasSize(0)));
    }
}
