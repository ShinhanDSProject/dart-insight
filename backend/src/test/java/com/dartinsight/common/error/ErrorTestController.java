package com.dartinsight.common.error;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** 에러 처리 테스트에서만 쓰는 컨트롤러(src/test에만 있음). */
@RestController
@RequestMapping("/test-errors")
class ErrorTestController {

    @GetMapping("/api-exception")
    String apiException() {
        throw new ApiException(ErrorCode.COMPANY_NOT_FOUND);
    }

    @GetMapping("/unexpected")
    String unexpected() {
        throw new IllegalStateException("예상하지 못한 오류");
    }

    @GetMapping("/param")
    String param(@RequestParam @Size(min = 2, message = "2자 이상 입력해 주세요.") String query) {
        return query;
    }

    @PostMapping("/body")
    String body(@Valid @RequestBody SampleBody body) {
        return body.name();
    }

    record SampleBody(@NotBlank(message = "필수 값입니다.") String name) {
    }
}
