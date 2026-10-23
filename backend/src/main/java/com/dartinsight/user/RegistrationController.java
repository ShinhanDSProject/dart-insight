package com.dartinsight.user;

import com.dartinsight.common.error.ApiException;
import com.dartinsight.common.error.ErrorCode;
import com.dartinsight.common.web.ApiPaths;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping(ApiPaths.USERS)
public class RegistrationController {
    private static final Logger log = LoggerFactory.getLogger(RegistrationController.class);
    private final RegistrationService registrationService;

    public RegistrationController(RegistrationService registrationService) {
        this.registrationService = registrationService;
    }

    @PostMapping
    public ResponseEntity<RegistrationService.RegisteredUser> register(@RequestBody RegistrationRequest request) {
        try {
            return ResponseEntity.status(201).body(registrationService.register(request.email, request.password));
        } catch (ApiException e) {
            throw e;
        } catch (RuntimeException e) {
            // 예상하지 못한 등록 실패도 입력값·해시·DB 메시지를 로그에 남기지 않는다.
            log.error("회원가입 처리 실패: {}", e.getClass().getSimpleName());
            throw new ApiException(ErrorCode.COMMON_INTERNAL_ERROR);
        }
    }

    /** Object로 받아 숫자/배열 등을 문자열로 강제 변환하지 않고 검증한다. */
    public static final class RegistrationRequest {
        public Object email;
        public Object password;

        @Override
        public String toString() { return "RegistrationRequest[redacted]"; }
    }
}
