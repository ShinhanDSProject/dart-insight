package com.dartinsight.user.service;

import com.dartinsight.common.error.ApiException;
import com.dartinsight.common.error.ErrorCode;
import com.dartinsight.user.domain.Nickname;
import com.dartinsight.user.domain.User;
import com.dartinsight.user.domain.UserProfile;
import com.dartinsight.user.repository.LocalCredentialRepository;
import com.dartinsight.user.repository.SocialAccountRepository;
import com.dartinsight.user.repository.UserRepository;
import java.time.Clock;
import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * 다른 도메인이 회원을 확인할 때 쓴다(PKG-3: UserRepository를 직접 쓰지 않음).
 * 토큰은 유효하지만 회원 행이 없으면(탈퇴 등) 로그인이 필요한 것으로 본다.
 */
@Service
@RequiredArgsConstructor
public class UserService {
    private final UserRepository users;
    private final LocalCredentialRepository credentials;
    private final SocialAccountRepository socialAccounts;
    private final Clock clock;

    @Transactional(readOnly = true)
    public void requireExisting(long userId) {
        if (!users.existsById(userId)) throw new ApiException(ErrorCode.AUTH_UNAUTHORIZED);
    }

    /** 회원 행을 잠가 같은 회원의 변경을 한 줄로 세운다. 부른 쪽 트랜잭션이 끝나면 풀린다. */
    @Transactional(propagation = Propagation.MANDATORY)
    public void lock(long userId) {
        users.findByIdForUpdate(userId).orElseThrow(() -> new ApiException(ErrorCode.AUTH_UNAUTHORIZED));
    }

    @Transactional(readOnly = true)
    public UserProfile profile(long userId) {
        return UserProfile.from(findOrThrow(userId));
    }

    /** 글·댓글을 쓰기 전에 닉네임을 정했는지(6.6). 정하지 않았으면 409 COMMUNITY_NICKNAME_REQUIRED */
    @Transactional(readOnly = true)
    public void requireNickname(long userId) {
        if (findOrThrow(userId).getNickname() == null) throw new ApiException(ErrorCode.COMMUNITY_NICKNAME_REQUIRED);
    }

    /** 회원 ID → 닉네임(정하지 않은 회원은 빠짐). 커뮤니티 작성자 표시에 쓴다 */
    @Transactional(readOnly = true)
    public Map<Long, String> nicknames(Collection<Long> userIds) {
        return users.findAllById(userIds).stream().filter(user -> user.getNickname() != null)
                .collect(Collectors.toMap(User::getId, User::getNickname));
    }

    /** 관리자 확인(ADR-0040). 회원 행이 없으면 관리자가 아니다. */
    @Transactional(readOnly = true)
    public boolean isAdmin(long userId) {
        return users.findById(userId).map(User::isAdmin).orElse(false);
    }

    /** 닉네임을 정하거나 바꾼다. 다른 사람이 쓰는 닉네임이면 409(동시에 정하면 DB UNIQUE가 하나만 남긴다). */
    @Transactional
    public String changeNickname(long userId, Object rawNickname) {
        String nickname = Nickname.of(rawNickname);
        User user = findOrThrow(userId);
        if (users.existsByNicknameIgnoreCaseAndIdNot(nickname, userId)) throw nicknameTaken();
        user.changeNickname(nickname, LocalDateTime.now(clock));
        try {
            users.saveAndFlush(user);
        } catch (DataIntegrityViolationException e) {
            throw nicknameTaken();
        }
        return user.getNickname();
    }

    /** 이 회원이 소유를 확인한 이메일(일반 가입·소셜). 관리자 지정에만 쓴다(ADR-0040). */
    @Transactional(readOnly = true)
    public List<String> verifiedEmails(long userId) {
        return Stream.concat(credentials.findVerifiedEmails(userId).stream(),
                socialAccounts.findVerifiedEmails(userId).stream()).toList();
    }

    /** 관리자로 올린다. 이미 관리자였으면 false. */
    @Transactional
    public boolean grantAdmin(long userId) {
        return findOrThrow(userId).grantAdmin(LocalDateTime.now(clock));
    }

    private User findOrThrow(long userId) {
        return users.findById(userId).orElseThrow(() -> new ApiException(ErrorCode.AUTH_UNAUTHORIZED));
    }

    private ApiException nicknameTaken() {
        return new ApiException(ErrorCode.COMMUNITY_NICKNAME_TAKEN);
    }
}
