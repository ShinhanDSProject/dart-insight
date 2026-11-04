package com.dartinsight.user.domain;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.Collections;
import java.util.EnumMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 회원 집계(관리자 개요).
 *
 * @param total 지금 전체 회원 수
 * @param admins 지금 관리자 수
 * @param byProvider 지금 전체 회원의 가입 방식별 수. 네 방식이 늘 키로 있다(없으면 0)
 * @param signedUpAts 기간 안에 가입한 회원의 가입 시각
 */
public record UserStats(long total, long admins, Map<LoginProvider, Long> byProvider,
        List<LocalDateTime> signedUpAts) {

    public UserStats {
        byProvider = Collections.unmodifiableMap(new LinkedHashMap<>(byProvider));
        signedUpAts = List.copyOf(signedUpAts);
    }

    /**
     * 가입 방식별 회원 수: 일반 가입이 있으면 LOCAL, 아니면 가장 먼저 연결한 소셜 제공자.
     *
     * @param socialAccountsInConnectedOrder 모든 소셜 계정, 먼저 연결한 것부터
     */
    public static Map<LoginProvider, Long> bySignupMethod(Set<Long> localUserIds,
            Collection<SocialAccount> socialAccountsInConnectedOrder) {
        Map<LoginProvider, Long> counts = new EnumMap<>(LoginProvider.class);
        for (LoginProvider provider : LoginProvider.values()) {
            counts.put(provider, 0L);
        }
        counts.put(LoginProvider.LOCAL, (long) localUserIds.size());
        Map<Long, String> firstSocial = new LinkedHashMap<>();
        socialAccountsInConnectedOrder.stream()
                .filter(account -> !localUserIds.contains(account.getUserId()))
                .forEach(account -> firstSocial.putIfAbsent(account.getUserId(), account.getProvider()));
        firstSocial.values().forEach(provider -> counts.merge(LoginProvider.ofSocial(provider), 1L, Long::sum));
        return counts;
    }
}
