package com.dartinsight.notification.controller;

import com.dartinsight.common.error.ApiException;
import com.dartinsight.common.web.ApiPaths;
import com.dartinsight.notification.dto.NotificationListResponse;
import com.dartinsight.notification.service.NotificationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** 내 분석 완료 알림(6.4, #38). 로그인한 회원만, 토큰의 사용자 ID로만 읽고 바꾼다 */
@RestController
@RequestMapping(ApiPaths.NOTIFICATIONS)
@RequiredArgsConstructor
public class NotificationController {

    private static final int MAX_LIMIT = 50;

    private final NotificationService notificationService;

    @GetMapping
    public NotificationListResponse list(@AuthenticationPrincipal Jwt jwt,
            @RequestParam(defaultValue = "20") int limit) {
        if (limit < 1 || limit > MAX_LIMIT) {
            throw ApiException.invalidInput("limit", "1에서 " + MAX_LIMIT + " 사이여야 합니다.");
        }
        return NotificationListResponse.from(notificationService.list(userId(jwt), limit));
    }

    @PutMapping(ApiPaths.NOTIFICATION_READ)
    public ResponseEntity<Void> markRead(@AuthenticationPrincipal Jwt jwt, @PathVariable long notificationId) {
        notificationService.markRead(userId(jwt), notificationId);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping(ApiPaths.NOTIFICATION_READ)
    public ResponseEntity<Void> markUnread(@AuthenticationPrincipal Jwt jwt, @PathVariable long notificationId) {
        notificationService.markUnread(userId(jwt), notificationId);
        return ResponseEntity.noContent().build();
    }

    private static long userId(Jwt jwt) {
        return Long.parseLong(jwt.getSubject());
    }
}
