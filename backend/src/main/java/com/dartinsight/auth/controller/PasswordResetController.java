package com.dartinsight.auth.controller;

import com.dartinsight.auth.dto.PasswordResetRequest;
import com.dartinsight.auth.service.PasswordResetService;
import com.dartinsight.common.web.ApiPaths;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 비밀번호 재설정 메일 요청(6.8). 가입 여부와 상관없이 204 */
@RestController
@RequestMapping(ApiPaths.PASSWORD_RESETS)
@RequiredArgsConstructor
public class PasswordResetController {
    private final PasswordResetService passwordResets;

    @PostMapping
    public ResponseEntity<Void> request(@RequestBody PasswordResetRequest request) {
        passwordResets.request(request.email());
        return ResponseEntity.noContent().build();
    }
}
