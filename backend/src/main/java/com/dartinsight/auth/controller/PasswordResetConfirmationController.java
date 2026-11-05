package com.dartinsight.auth.controller;

import com.dartinsight.auth.dto.PasswordResetConfirmationRequest;
import com.dartinsight.auth.service.PasswordResetService;
import com.dartinsight.common.web.ApiPaths;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 재설정 링크로 새 비밀번호 정하기(6.8) */
@RestController
@RequestMapping(ApiPaths.PASSWORD_RESET_CONFIRMATIONS)
@RequiredArgsConstructor
public class PasswordResetConfirmationController {
    private final PasswordResetService passwordResets;

    @PostMapping
    public ResponseEntity<Void> confirm(@RequestBody PasswordResetConfirmationRequest request) {
        passwordResets.confirm(request.token(), request.password());
        return ResponseEntity.noContent().build();
    }
}
