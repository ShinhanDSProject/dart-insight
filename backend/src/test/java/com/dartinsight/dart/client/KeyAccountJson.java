package com.dartinsight.dart.client;

/**
 * 테스트용 단일회사 주요계정(fnlttSinglAcnt.json) 응답 JSON. 모양은 실제 응답(삼성전자 2026 반기,
 * 접수번호 20260814003699)을 따랐고, 회사·금액은 가짜다.
 */
public final class KeyAccountJson {

    public static final String NO_DATA = "{\"status\":\"013\",\"message\":\"조회된 데이타가 없습니다.\"}";
    public static final String RATE_LIMITED = "{\"status\":\"020\",\"message\":\"요청 제한을 초과하였습니다.\"}";

    private KeyAccountJson() {
    }

    public static String ok(String... rows) {
        return """
                {"status":"000","message":"정상","list":[%s]}
                """.formatted(String.join(",", rows));
    }

    /**
     * @param amount    당기금액(쉼표 든 문자열, 빈 값·'-' 가능)
     * @param addAmount 당기누적금액. null이면 필드를 넣지 않는다(재무상태표·사업보고서처럼)
     */
    public static String row(String rceptNo, String fsDiv, String sjDiv, String accountName, int ord, String amount,
            String addAmount) {
        String add = addAmount == null ? "" : ",\"thstrm_add_amount\":\"" + addAmount + "\"";
        return """
                {"rcept_no":"%s","bsns_year":"2026","stock_code":"900001","reprt_code":"11012",
                 "account_nm":"%s","fs_div":"%s","fs_nm":"%s","sj_div":"%s","sj_nm":"%s",
                 "thstrm_nm":"제 10 기반기","thstrm_dt":"2026.01.01 ~ 2026.06.30","thstrm_amount":"%s"%s,
                 "frmtrm_nm":"제 9 기반기","frmtrm_amount":"1,000","ord":"%d","currency":"KRW"}
                """.formatted(rceptNo, accountName, fsDiv, "CFS".equals(fsDiv) ? "연결재무제표" : "재무제표", sjDiv,
                "BS".equals(sjDiv) ? "재무상태표" : "손익계산서", amount, add, ord);
    }
}
