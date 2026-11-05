package com.dartinsight.llmquota.domain;

import java.net.InetAddress;
import java.net.UnknownHostException;

/**
 * 하루 한도를 셀 클라이언트 IP(ADR-0054). 요청이 프록시(사설망·루프백 주소)에서 왔을 때만 X-Forwarded-For의 첫 주소를 믿는다.
 * 밖에서 바로 온 요청이 X-Forwarded-For를 지어 보내도 한도를 피하지 못하게 하려는 것이다.
 */
public final class ClientAddress {

    private ClientAddress() {
    }

    public static String resolve(String remoteAddr, String forwardedFor) {
        if (forwardedFor == null || forwardedFor.isBlank() || !fromProxy(remoteAddr)) {
            return remoteAddr;
        }
        String first = forwardedFor.split(",")[0].trim();
        return first.isEmpty() ? remoteAddr : first;
    }

    private static boolean fromProxy(String remoteAddr) {
        if (remoteAddr == null || !remoteAddr.matches("[0-9a-fA-F:.]+")) {
            return false;
        }
        try {
            InetAddress address = InetAddress.getByName(remoteAddr);
            return address.isLoopbackAddress() || address.isSiteLocalAddress();
        } catch (UnknownHostException e) {
            return false;
        }
    }
}
