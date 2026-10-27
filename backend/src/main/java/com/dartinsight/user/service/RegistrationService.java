package com.dartinsight.user.service;

import com.dartinsight.common.error.ApiException;
import com.dartinsight.common.error.ErrorCode;
import com.dartinsight.user.domain.LocalCredential;
import com.dartinsight.user.domain.RegistrationInput;
import com.dartinsight.user.domain.User;
import com.dartinsight.user.dto.RegistrationResponse;
import com.dartinsight.user.repository.LocalCredentialRepository;
import com.dartinsight.user.repository.UserRepository;
import java.time.Clock;
import java.time.LocalDateTime;
import java.util.Locale;
import lombok.RequiredArgsConstructor;
import org.hibernate.exception.ConstraintViolationException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

@Service
@RequiredArgsConstructor
public class RegistrationService {
    private static final Logger log = LoggerFactory.getLogger(RegistrationService.class);
    private final UserRepository users;
    private final LocalCredentialRepository credentials;
    private final PasswordEncoder passwords;
    private final TransactionTemplate transactions;
    private final Clock clock;

    public RegistrationResponse register(Object rawEmail, Object rawPassword) {
        try {
            return registerChecked(rawEmail, rawPassword);
        } catch (ApiException e) {
            throw e;
        } catch (RuntimeException e) {
            // 예상하지 못한 등록 실패도 입력값·해시·DB 메시지를 로그에 남기지 않는다.
            log.error("회원가입 처리 실패: {}", e.getClass().getSimpleName());
            throw new ApiException(ErrorCode.COMMON_INTERNAL_ERROR);
        }
    }

    private RegistrationResponse registerChecked(Object rawEmail, Object rawPassword) {
        String email = RegistrationInput.email(rawEmail);
        String password = RegistrationInput.password(rawPassword);
        if (credentials.existsByEmail(email)) {
            throw new ApiException(ErrorCode.COMMON_EMAIL_ALREADY_EXISTS);
        }
        // 해시 계산 중에는 DB 트랜잭션과 연결을 점유하지 않는다.
        String hash = passwords.encode(password);
        try {
            return transactions.execute(status -> {
                User user = users.saveAndFlush(User.create(LocalDateTime.now(clock)));
                credentials.saveAndFlush(LocalCredential.create(user, email, hash));
                return new RegistrationResponse(user.getId(), email);
            });
        } catch (DataIntegrityViolationException e) {
            // 트랜잭션이 롤백된 뒤, 해당 UNIQUE 위반만 중복 가입으로 분류한다.
            for (Throwable cause = e; cause != null; cause = cause.getCause()) {
                if (cause instanceof ConstraintViolationException violation) {
                    String name = violation.getConstraintName();
                    if (name != null && name.toLowerCase(Locale.ROOT).contains("uk_local_credential_email")) {
                        throw new ApiException(ErrorCode.COMMON_EMAIL_ALREADY_EXISTS);
                    }
                }
            }
            // DB 예외의 메시지/SQL 바인딩이 응답 또는 로그로 전달되지 않게 원인을 붙이지 않는다.
            throw new ApiException(ErrorCode.COMMON_INTERNAL_ERROR);
        }
    }
}
