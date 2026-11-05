package com.dartinsight.llmquota.domain;

/**
 * 하루 한도를 세는 호출자(ADR-0054). 회원이면 회원 ID, 아니면 클라이언트 IP로 센다.
 *
 * @param userId 로그인한 회원 ID. 비로그인이면 null
 * @param clientIp {@link ClientAddress}로 정한 클라이언트 IP
 */
public record QuotaCaller(Long userId, String clientIp) {

    /** 요청의 연결 주소·X-Forwarded-For로 클라이언트 IP를 정한다 */
    public static QuotaCaller of(Long userId, String remoteAddr, String forwardedFor) {
        return new QuotaCaller(userId, ClientAddress.resolve(remoteAddr, forwardedFor));
    }

    public boolean member() {
        return userId != null;
    }

    /** 횟수를 세는 열쇠. 회원과 IP가 겹치지 않게 앞에 종류를 붙인다 */
    public String key() {
        return member() ? "user:" + userId : "ip:" + clientIp;
    }
}
