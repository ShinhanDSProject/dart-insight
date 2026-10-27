package com.dartinsight.user.service;

import com.dartinsight.common.error.ApiException;
import com.dartinsight.common.error.ErrorCode;
import com.dartinsight.user.domain.LocalCredential;
import com.dartinsight.user.domain.RegistrationInput;
import com.dartinsight.user.repository.LocalCredentialRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

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

    private ApiException invalidCredentials() {
        return new ApiException(ErrorCode.AUTH_INVALID_CREDENTIALS);
    }

    public record AuthenticatedUser(long userId, String email) {}
}
