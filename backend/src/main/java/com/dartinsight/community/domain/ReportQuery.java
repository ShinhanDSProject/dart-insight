package com.dartinsight.community.domain;

import com.dartinsight.common.error.ApiException;
import java.util.Locale;

/** 관리자 신고 목록 조건(GET /api/admin/reports). 값이 없으면 처리할 것, 0쪽, 20개. */
public record ReportQuery(Queue queue, int page, int size) {

    public enum Queue {
        /** 처리할 것(대기·재게시 청구·기한 지남) */
        TODO,
        /** 처리한 것을 포함한 전체 */
        ALL
    }

    public static ReportQuery of(String queue, Integer page, Integer size) {
        return new ReportQuery(queue(queue), PostQuery.page(page), PostQuery.size(size));
    }

    public String queueName() {
        return queue.name().toLowerCase(Locale.ROOT);
    }

    private static Queue queue(String raw) {
        if (raw == null || raw.isBlank()) return Queue.TODO;
        return switch (raw.strip()) {
            case "todo" -> Queue.TODO;
            case "all" -> Queue.ALL;
            default -> throw ApiException.invalidInput("queue", "todo 또는 all이어야 합니다.");
        };
    }
}
