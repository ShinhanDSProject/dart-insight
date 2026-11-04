package com.dartinsight.admin.dto;

import com.dartinsight.user.domain.LoginProvider;
import com.dartinsight.user.domain.UserListing;
import com.dartinsight.user.domain.UserPage;
import com.dartinsight.user.domain.UserRole;
import com.fasterxml.jackson.annotation.JsonFormat;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/** 관리자 회원 목록(docs/api-spec.md GET /api/admin/users). 이메일은 가린 값만 담는다. */
public record AdminUserListResponse(int page, int size, long totalItems, List<Item> items) {

    /**
     * @param favoriteCounts 회원 ID → 관심 기업 수(없으면 0)
     * @param postCounts 회원 ID → 지우지 않은 글 수(없으면 0)
     */
    public static AdminUserListResponse of(UserPage page, Map<Long, Long> favoriteCounts,
            Map<Long, Long> postCounts) {
        return new AdminUserListResponse(page.page(), page.size(), page.totalItems(), page.items().stream()
                .map(user -> Item.of(user, favoriteCounts.getOrDefault(user.userId(), 0L),
                        postCounts.getOrDefault(user.userId(), 0L)))
                .toList());
    }

    /** @param maskedEmail 가린 이메일. 이메일이 없으면 null */
    public record Item(long userId, String nickname, String maskedEmail, List<LoginProvider> providers,
            UserRole role, @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss") LocalDateTime createdAt,
            long favoriteCount, long postCount) {

        static Item of(UserListing user, long favoriteCount, long postCount) {
            return new Item(user.userId(), user.nickname(), user.maskedEmail(), user.providers(), user.role(),
                    user.createdAt(), favoriteCount, postCount);
        }
    }
}
