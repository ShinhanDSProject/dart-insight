package com.dartinsight.user;

import com.dartinsight.common.error.ApiException;
import com.dartinsight.common.error.ErrorCode;
import java.time.Clock;
import java.time.LocalDateTime;
import java.util.Locale;
import lombok.RequiredArgsConstructor;
import org.hibernate.exception.ConstraintViolationException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

@Service
@RequiredArgsConstructor
public class RegistrationService {
    private final UserRepository users;
    private final LocalCredentialRepository credentials;
    private final PasswordEncoder passwords;
    private final TransactionTemplate transactions;
    private final Clock clock;

    public RegisteredUser register(Object rawEmail, Object rawPassword) {
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
                return new RegisteredUser(user.getId(), email);
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

    public record RegisteredUser(long userId, String email) {}
}
