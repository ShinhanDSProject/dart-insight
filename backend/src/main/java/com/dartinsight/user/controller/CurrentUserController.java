package com.dartinsight.user.controller;

import com.dartinsight.common.web.ApiPaths;
import com.dartinsight.user.dto.NicknameRequest;
import com.dartinsight.user.dto.NicknameResponse;
import com.dartinsight.user.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 로그인한 사용자 자신의 정보. 사용자는 토큰의 sub로만 정한다. */
@RestController
@RequestMapping(ApiPaths.CURRENT_USER)
@RequiredArgsConstructor
public class CurrentUserController {
    private final UserService userService;

    @PutMapping(ApiPaths.NICKNAME)
    public NicknameResponse changeNickname(@AuthenticationPrincipal Jwt jwt, @RequestBody NicknameRequest request) {
        return new NicknameResponse(userService.changeNickname(Long.parseLong(jwt.getSubject()), request.nickname()));
    }
}
