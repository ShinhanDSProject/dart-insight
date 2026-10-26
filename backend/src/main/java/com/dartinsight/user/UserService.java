package com.dartinsight.user;

import com.dartinsight.common.error.ApiException;
import com.dartinsight.common.error.ErrorCode;
import lombok.RequiredArgsConstructor;
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

    @Transactional(readOnly = true)
    public void requireExisting(long userId) {
        if (!users.existsById(userId)) throw new ApiException(ErrorCode.AUTH_UNAUTHORIZED);
    }

    /** 회원 행을 잠가 같은 회원의 변경을 한 줄로 세운다. 부른 쪽 트랜잭션이 끝나면 풀린다. */
    @Transactional(propagation = Propagation.MANDATORY)
    public void lock(long userId) {
        users.findByIdForUpdate(userId).orElseThrow(() -> new ApiException(ErrorCode.AUTH_UNAUTHORIZED));
    }
}
