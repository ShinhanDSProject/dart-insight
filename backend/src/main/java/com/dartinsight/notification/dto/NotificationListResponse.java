package com.dartinsight.notification.dto;

import com.dartinsight.notification.service.NotificationService.NotificationList;
import java.util.List;

/** 내 분석 완료 알림(6.4). unreadCount는 limit과 상관없이 읽지 않은 전체 수 */
public record NotificationListResponse(long unreadCount, List<NotificationResponse> items) {

    public static NotificationListResponse from(NotificationList list) {
        return new NotificationListResponse(list.unreadCount(),
                list.items().stream().map(NotificationResponse::from).toList());
    }
}
