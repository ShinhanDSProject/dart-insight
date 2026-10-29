package com.dartinsight.auth.domain;

import java.util.Collection;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;

/** 로그인할 때 관리자로 올릴 이메일 목록(환경변수 ADMIN_EMAILS, ADR-0040). 대소문자와 앞뒤 공백은 무시한다. */
public record AdminEmails(Set<String> emails) {
    public static AdminEmails of(Collection<String> raw) {
        return new AdminEmails(raw.stream()
                .map(email -> email.strip().toLowerCase(Locale.ROOT))
                .filter(email -> !email.isEmpty())
                .collect(Collectors.toUnmodifiableSet()));
    }

    public boolean containsAny(Collection<String> candidates) {
        return candidates.stream().anyMatch(email -> emails.contains(email.strip().toLowerCase(Locale.ROOT)));
    }
}
