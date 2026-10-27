package com.dartinsight.user.controller;

import com.dartinsight.common.web.ApiPaths;
import com.dartinsight.user.dto.RegistrationRequest;
import com.dartinsight.user.dto.RegistrationResponse;
import com.dartinsight.user.service.RegistrationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping(ApiPaths.USERS)
@RequiredArgsConstructor
public class RegistrationController {
    private final RegistrationService registrationService;

    @PostMapping
    public ResponseEntity<RegistrationResponse> register(@RequestBody RegistrationRequest request) {
        return ResponseEntity.status(201).body(registrationService.register(request.email(), request.password()));
    }
}
