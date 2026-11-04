package com.dartinsight.admin.service;

import com.dartinsight.admin.dto.AdminUserListResponse;
import com.dartinsight.community.service.CommunityPostService;
import com.dartinsight.favorite.service.FavoriteCompanyService;
import com.dartinsight.user.domain.UserListing;
import com.dartinsight.user.domain.UserPage;
import com.dartinsight.user.service.UserDirectoryService;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 관리자 회원 목록(3.34, FS-72). 회원은 user, 관심 기업 수는 favorite, 글 수는 community Service에서 읽는다(PKG-3).
 * user가 favorite·community에 기대지 않게(순환 참조) 이 도메인에서 합친다.
 */
@Service
@Transactional(readOnly = true)
@RequiredArgsConstructor
public class AdminUserService {
    private final UserDirectoryService userDirectoryService;
    private final FavoriteCompanyService favoriteCompanyService;
    private final CommunityPostService communityPostService;

    public AdminUserListResponse list(String q, String role, Integer page, Integer size) {
        UserPage found = userDirectoryService.search(q, role, page, size);
        List<Long> ids = found.items().stream().map(UserListing::userId).toList();
        return AdminUserListResponse.of(found, favoriteCompanyService.countsByUser(ids),
                communityPostService.countsByAuthor(ids));
    }
}
