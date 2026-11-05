package com.dartinsight.auth.service;

import com.dartinsight.auth.client.PasswordResetMailer;
import com.dartinsight.auth.config.PasswordResetProperties;
import com.dartinsight.auth.domain.OpaqueTokens;
import com.dartinsight.auth.domain.PasswordResetToken;
import com.dartinsight.auth.repository.PasswordResetTokenRepository;
import com.dartinsight.auth.repository.RefreshTokenRepository;
import com.dartinsight.common.error.ApiException;
import com.dartinsight.common.error.ErrorCode;
import com.dartinsight.user.domain.RegistrationInput;
import com.dartinsight.user.service.CredentialAuthenticationService;
import java.time.Clock;
import java.time.LocalDateTime;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.task.SyncTaskExecutor;
import org.springframework.core.task.TaskExecutor;
import org.springframework.core.task.TaskRejectedException;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * 비밀번호 재설정(6.8, ADR-0055). 요청은 가입 여부와 상관없이 같은 응답을 주고, 찾기·토큰 만들기·메일은 응답과 따로 한다.
 * 확정은 토큰을 한 번 쓰고 비밀번호를 바꾸며 그 회원의 모든 Refresh Token을 폐기한다.
 */
@Service
public class PasswordResetService {
    private static final Logger log = LoggerFactory.getLogger(PasswordResetService.class);
    private static final int MAX_TOKEN_LENGTH = 100;

    private final CredentialAuthenticationService credentials;
    private final PasswordResetTokenRepository resetTokens;
    private final RefreshTokenRepository refreshTokens;
    private final PasswordResetMailer mailer;
    private final PasswordResetProperties properties;
    private final TransactionTemplate transactions;
    private final Clock clock;
    private final TaskExecutor executor;

    public PasswordResetService(CredentialAuthenticationService credentials, PasswordResetTokenRepository resetTokens,
            RefreshTokenRepository refreshTokens, PasswordResetMailer mailer, PasswordResetProperties properties,
            TransactionTemplate transactions, Clock clock) {
        this.credentials = credentials;
        this.resetTokens = resetTokens;
        this.refreshTokens = refreshTokens;
        this.mailer = mailer;
        this.properties = properties;
        this.transactions = transactions;
        this.clock = clock;
        if (properties.async()) {
            ThreadPoolTaskExecutor pool = new ThreadPoolTaskExecutor();
            pool.setThreadNamePrefix("password-reset-");
            pool.setCorePoolSize(1);
            pool.setMaxPoolSize(2);
            pool.setQueueCapacity(50);
            pool.initialize();
            this.executor = pool;
        } else {
            this.executor = new SyncTaskExecutor();
        }
    }

    /** 이메일 형식만 바로 검사하고(틀리면 400), 나머지는 따로 처리한다 */
    public void request(Object rawEmail) {
        String email = RegistrationInput.email(rawEmail);
        try {
            executor.execute(() -> issueAndSend(email));
        } catch (TaskRejectedException e) {
            log.warn("비밀번호 재설정 대기열이 가득 차 처리하지 못했습니다");
        }
    }

    public void confirm(Object rawToken, Object rawPassword) {
        String token = tokenText(rawToken);
        // 해시는 느려 트랜잭션 밖에서 만든다
        String newPasswordHash = credentials.encodeNewPassword(rawPassword);
        transactions.executeWithoutResult(status -> {
            LocalDateTime now = now();
            PasswordResetToken reset = resetTokens.findForUpdate(OpaqueTokens.hash(token))
                    .filter(found -> found.usableAt(now))
                    .orElseThrow(PasswordResetService::invalidToken);
            reset.use(now);
            credentials.resetPassword(reset.userId(), newPasswordHash);
            refreshTokens.revokeAllForUser(reset.userId(), now);
        });
    }

    private void issueAndSend(String email) {
        try {
            Optional<Long> userId = credentials.findLocalUserId(email);
            if (userId.isEmpty()) return;
            Optional<String> token = transactions.execute(status -> issue(userId.get()));
            if (token != null && token.isPresent()) mailer.send(email, properties.pageUrl() + "?token=" + token.get());
        } catch (RuntimeException e) {
            // 응답은 이미 나갔다. 이메일·토큰·메일 서버 메시지는 남기지 않는다
            log.error("비밀번호 재설정 메일 처리 실패: {}", e.getClass().getSimpleName());
        }
    }

    /** 새 토큰을 만들고 이전 토큰을 못 쓰게 한다. 짧은 시간 안에 다시 요청했으면 만들지 않는다 */
    private Optional<String> issue(long userId) {
        LocalDateTime now = now();
        if (resetTokens.existsByUserIdAndCreatedAtAfter(userId, now.minus(properties.resendInterval()))) {
            return Optional.empty();
        }
        resetTokens.retireUnused(userId, now);
        String token = OpaqueTokens.newToken();
        resetTokens.save(PasswordResetToken.create(userId, OpaqueTokens.hash(token), now, now.plus(properties.tokenTtl())));
        return Optional.of(token);
    }

    private static String tokenText(Object rawToken) {
        if (rawToken instanceof String token && !token.isBlank() && token.length() <= MAX_TOKEN_LENGTH) return token;
        throw invalidToken();
    }

    private static ApiException invalidToken() { return new ApiException(ErrorCode.AUTH_INVALID_RESET_TOKEN); }

    private LocalDateTime now() { return LocalDateTime.now(clock); }
}
