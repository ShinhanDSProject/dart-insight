package com.dartinsight.user.service;

import com.dartinsight.common.error.ApiException;
import com.dartinsight.common.error.ErrorCode;
import com.dartinsight.user.domain.LocalCredential;
import com.dartinsight.user.domain.RegistrationInput;
import com.dartinsight.user.repository.LocalCredentialRepository;
import java.util.Optional;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 일반 가입 자격 증명을 확인하고 auth 도메인에는 내부 회원 정보만 돌려준다. */
@Service
public class CredentialAuthenticationService {
    private final LocalCredentialRepository credentials;
    private final PasswordEncoder passwords;
    private final String dummyHash;

    public CredentialAuthenticationService(LocalCredentialRepository credentials, PasswordEncoder passwords) {
        this.credentials = credentials;
        this.passwords = passwords;
        this.dummyHash = passwords.encode("Dummy!password-for-timing");
    }

    public AuthenticatedUser authenticate(Object rawEmail, Object rawPassword) {
        String email;
        String password;
        try {
            email = RegistrationInput.email(rawEmail);
            password = RegistrationInput.password(rawPassword);
        } catch (ApiException e) {
            passwords.matches("invalid-input", dummyHash);
            throw invalidCredentials();
        }

        LocalCredential credential = credentials.findByEmail(email).orElse(null);
        if (credential == null) {
            passwords.matches(password, dummyHash);
            throw invalidCredentials();
        }
        if (!credential.matchesPassword(passwords, password)) {
            throw invalidCredentials();
        }
        return new AuthenticatedUser(credential.userId(), credential.email());
    }

    /** 비밀번호 재설정(6.8): 정규화한 이메일로 일반 가입 회원을 찾는다. 소셜 회원·없는 이메일은 빈 값 */
    public Optional<Long> findLocalUserId(String email) {
        return credentials.findByEmail(email).map(LocalCredential::userId);
    }

    /** 새 비밀번호를 가입과 같은 규칙으로 검사하고 해시한다. 해시는 느려 트랜잭션 밖에서 부른다 */
    public String encodeNewPassword(Object rawPassword) {
        return passwords.encode(RegistrationInput.password(rawPassword));
    }

    /** 미리 해시한 새 비밀번호로 바꾼다. 부르는 쪽 트랜잭션에 함께 묶인다 */
    @Transactional
    public void resetPassword(long userId, String newPasswordHash) {
        credentials.findByUserId(userId)
                .orElseThrow(() -> new IllegalStateException("재설정 토큰의 회원에 일반 가입 정보가 없음"))
                .resetPassword(newPasswordHash);
    }

    private ApiException invalidCredentials() {
        return new ApiException(ErrorCode.AUTH_INVALID_CREDENTIALS);
    }

    public record AuthenticatedUser(long userId, String email) {}
}
