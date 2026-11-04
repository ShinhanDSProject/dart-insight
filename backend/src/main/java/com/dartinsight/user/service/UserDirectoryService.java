package com.dartinsight.user.service;

import com.dartinsight.user.domain.LocalCredential;
import com.dartinsight.user.domain.LoginMethods;
import com.dartinsight.user.domain.SocialAccount;
import com.dartinsight.user.domain.User;
import com.dartinsight.user.domain.UserListing;
import com.dartinsight.user.domain.UserPage;
import com.dartinsight.user.domain.UserQuery;
import com.dartinsight.user.domain.UserRole;
import com.dartinsight.user.domain.UserStats;
import com.dartinsight.user.repository.LocalCredentialRepository;
import com.dartinsight.user.repository.SocialAccountRepository;
import com.dartinsight.user.repository.UserRepository;
import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 관리자 회원 목록·집계(3.34, FS-72). 이메일은 가린 값만 user 도메인 밖으로 내보낸다.
 * 관리자인지는 SecurityConfig가 /api/admin 아래에서 확인한다(ADR-0040).
 */
@Service
@Transactional(readOnly = true)
@RequiredArgsConstructor
public class UserDirectoryService {
    private final UserRepository users;
    private final LocalCredentialRepository credentials;
    private final SocialAccountRepository socialAccounts;

    /** q는 닉네임(부분 일치) 또는 이메일(전체 일치, 대소문자 무시). 조건이 규칙에 맞지 않으면 400 */
    public UserPage search(String q, String role, Integer page, Integer size) {
        UserQuery query = UserQuery.of(q, role, page, size);
        Page<User> found = users.search(query.role(), query.nicknamePattern(), query.email(),
                query.localEmail(), PageRequest.of(query.page().page(), query.page().size()));
        List<Long> ids = found.getContent().stream().map(User::getId).toList();
        Map<Long, String> localEmails = ids.isEmpty() ? Map.of() : credentials.findByUserIds(ids).stream()
                .collect(Collectors.toMap(LocalCredential::userId, LocalCredential::email));
        Map<Long, List<SocialAccount>> socials = ids.isEmpty() ? Map.of()
                : socialAccounts.findByUserIdInOrderByCreatedAtAscIdAsc(ids).stream()
                        .collect(Collectors.groupingBy(SocialAccount::getUserId));
        List<UserListing> items = found.getContent().stream()
                .map(user -> UserListing.of(user, new LoginMethods(localEmails.get(user.getId()),
                        socials.getOrDefault(user.getId(), List.of()))))
                .toList();
        return new UserPage(query.page().page(), query.page().size(), found.getTotalElements(), items);
    }

    /** 지금 전체 회원 수·관리자 수·가입 방식별 수와 [from, to)에 가입한 시각 */
    public UserStats stats(LocalDateTime from, LocalDateTime to) {
        return new UserStats(users.count(), users.countByRole(UserRole.ADMIN),
                UserStats.bySignupMethod(new HashSet<>(credentials.findAllUserIds()),
                        socialAccounts.findAllByOrderByCreatedAtAscIdAsc()),
                users.findCreatedAts(from, to));
    }
}
