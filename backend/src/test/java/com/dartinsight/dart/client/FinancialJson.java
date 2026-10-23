package com.dartinsight.dart.client;

import java.util.List;

/**
 * 테스트용 단일회사 전체 재무제표(fnlttSinglAcntAll.json) 응답 JSON. 회사·금액은 모두 가짜다.
 */
public final class FinancialJson {

    public static final String NO_DATA = "{\"status\":\"013\",\"message\":\"조회된 데이타가 없습니다.\"}";
    public static final String RATE_LIMITED = "{\"status\":\"020\",\"message\":\"요청 제한을 초과하였습니다.\"}";

    private FinancialJson() {
    }

    public static String ok(String... accounts) {
        return """
                {"status":"000","message":"정상","list":[%s]}
                """.formatted(String.join(",", accounts));
    }

    private static final List<String> AMOUNT_FIELDS = List.of("thstrm_amount", "thstrm_add_amount",
            "frmtrm_amount", "frmtrm_q_amount", "frmtrm_add_amount");

    /** 금액 순서: 당기, 당기 누적, 전기, 전기 3개월, 전기 누적. 없으면 빈 문자열로 보낸다 */
    public static String account(String rceptNo, String sjDiv, String accountId, String accountName, int ord,
            String... amounts) {
        StringBuilder fields = new StringBuilder();
        for (int i = 0; i < AMOUNT_FIELDS.size(); i++) {
            String value = i < amounts.length && amounts[i] != null ? amounts[i] : "";
            fields.append(i == 0 ? "" : ",").append('"').append(AMOUNT_FIELDS.get(i)).append("\":\"")
                    .append(value).append('"');
        }
        return """
                {"rcept_no":"%s","reprt_code":"11012","bsns_year":"2026","corp_code":"00000001",
                 "sj_div":"%s","sj_nm":"%s","account_id":"%s","account_nm":"%s","account_detail":"-",
                 "thstrm_nm":"제 10 기 반기","frmtrm_nm":"제 9 기 반기",%s,"ord":"%d","currency":"KRW"}
                """.formatted(rceptNo, sjDiv, sjName(sjDiv), accountId, accountName, fields, ord);
    }

    private static String sjName(String sjDiv) {
        return switch (sjDiv) {
            case "BS" -> "재무상태표";
            case "IS" -> "손익계산서";
            case "CIS" -> "포괄손익계산서";
            case "CF" -> "현금흐름표";
            default -> "자본변동표";
        };
    }
}
