package com.dartinsight.common.error;

import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.notNullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
class GlobalExceptionHandlerTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void apiExceptionUsesItsStatusAndCode() throws Exception {
        mockMvc.perform(get("/test-errors/api-exception"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("COMPANY_NOT_FOUND"))
                .andExpect(jsonPath("$.message").value(ErrorCode.COMPANY_NOT_FOUND.defaultMessage()))
                .andExpect(jsonPath("$.traceId").value(notNullValue()))
                .andExpect(jsonPath("$.errors", hasSize(0)));
    }

    @Test
    void unknownPathReturnsCommonNotFound() throws Exception {
        mockMvc.perform(get("/api/does-not-exist"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("COMMON_NOT_FOUND"));
    }

    @Test
    void unexpectedErrorReturns500WithoutDetails() throws Exception {
        mockMvc.perform(get("/test-errors/unexpected"))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.code").value("COMMON_INTERNAL_ERROR"))
                .andExpect(jsonPath("$.message").value(ErrorCode.COMMON_INTERNAL_ERROR.defaultMessage()));
    }

    @Test
    void invalidParameterListsFieldErrors() throws Exception {
        mockMvc.perform(get("/test-errors/param").param("query", "a"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("COMMON_INVALID_INPUT"))
                .andExpect(jsonPath("$.errors[0].field").value("query"))
                .andExpect(jsonPath("$.errors[0].reason").value("2자 이상 입력해 주세요."));
    }

    @Test
    void missingParameterIsInvalidInput() throws Exception {
        mockMvc.perform(get("/test-errors/param"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("COMMON_INVALID_INPUT"))
                .andExpect(jsonPath("$.errors[0].field").value("query"));
    }

    @Test
    void invalidBodyListsFieldErrors() throws Exception {
        mockMvc.perform(post("/test-errors/body").contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("name"))
                .andExpect(jsonPath("$.errors[0].reason").value("필수 값입니다."));
    }

    @Test
    void unreadableBodyIsInvalidInput() throws Exception {
        mockMvc.perform(post("/test-errors/body").contentType(MediaType.APPLICATION_JSON).content("{not json"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("COMMON_INVALID_INPUT"));
    }

    @Test
    @DisplayName("깨진 JSON이면 필드를 알 수 없어 errors가 비어 있다")
    void malformedJsonHasNoFieldErrors() throws Exception {
        mockMvc.perform(post("/test-errors/typed-body").contentType(MediaType.APPLICATION_JSON).content("{not json"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("COMMON_INVALID_INPUT"))
                .andExpect(jsonPath("$.message").value("요청 본문을 읽을 수 없습니다. JSON 형식을 확인해 주세요."))
                .andExpect(jsonPath("$.errors", hasSize(0)));
    }

    @Test
    @DisplayName("본문의 enum 값이 정해진 값이 아니면 필드와 허용 값을 errors에 담는다")
    void unknownEnumValueInBodyListsAllowedValues() throws Exception {
        mockMvc.perform(post("/test-errors/typed-body").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"color\":\"GREEN\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("COMMON_INVALID_INPUT"))
                .andExpect(jsonPath("$.message").value(ErrorCode.COMMON_INVALID_INPUT.defaultMessage()))
                .andExpect(jsonPath("$.errors", hasSize(1)))
                .andExpect(jsonPath("$.errors[0].field").value("color"))
                .andExpect(jsonPath("$.errors[0].reason").value("허용 값: RED, BLUE"));
    }

    @Test
    @DisplayName("본문 필드의 타입이 맞지 않으면 필드 경로와 이유를 errors에 담는다")
    void wrongTypeInBodyListsFieldPath() throws Exception {
        mockMvc.perform(post("/test-errors/typed-body").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"count\":\"many\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("count"))
                .andExpect(jsonPath("$.errors[0].reason").value("값의 형식이 맞지 않습니다."));
        mockMvc.perform(post("/test-errors/typed-body").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"items\":[{\"color\":\"RED\"},{\"color\":\"PINK\"}]}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("items[1].color"))
                .andExpect(jsonPath("$.errors[0].reason").value("허용 값: RED, BLUE"));
    }

    @Test
    void unsupportedContentTypeKeepsItsClientErrorStatus() throws Exception {
        mockMvc.perform(post("/test-errors/body").contentType(MediaType.TEXT_PLAIN).content("name"))
                .andExpect(status().isUnsupportedMediaType())
                .andExpect(jsonPath("$.code").value("COMMON_INVALID_INPUT"));
    }

    @Test
    void wrongMethodReturns405() throws Exception {
        mockMvc.perform(post("/test-errors/api-exception"))
                .andExpect(status().isMethodNotAllowed())
                .andExpect(jsonPath("$.code").value("COMMON_METHOD_NOT_ALLOWED"));
    }

    @Test
    void traceIdFromRequestIsEchoedInHeaderAndBody() throws Exception {
        mockMvc.perform(get("/test-errors/api-exception").header("X-Trace-Id", "abc-123"))
                .andExpect(header().string("X-Trace-Id", "abc-123"))
                .andExpect(jsonPath("$.traceId").value("abc-123"));
    }

    @Test
    void invalidTraceIdIsReplaced() throws Exception {
        mockMvc.perform(get("/test-errors/api-exception").header("X-Trace-Id", "bad id with spaces"))
                .andExpect(header().string("X-Trace-Id", org.hamcrest.Matchers.matchesPattern("[a-f0-9]{16}")));
    }
}
