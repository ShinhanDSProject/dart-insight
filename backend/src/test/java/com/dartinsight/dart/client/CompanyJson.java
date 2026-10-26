package com.dartinsight.dart.client;

/**
 * 테스트용 기업개황(company.json) 응답.
 * SAMSUNG은 2026-10-26 OpenDART에서 삼성전자(00126380)로 실제로 받은 응답 그대로다(주소의 두 칸 공백, 빈 ir_url 포함).
 */
public final class CompanyJson {

    public static final String SAMSUNG = """
            {"status":"000","message":"정상","corp_code":"00126380","corp_name":"삼성전자(주)",\
            "corp_name_eng":"SAMSUNG ELECTRONICS CO,.LTD","stock_name":"삼성전자","stock_code":"005930",\
            "ceo_nm":"전영현, 노태문","corp_cls":"Y","jurir_no":"1301110006246","bizr_no":"1248100998",\
            "adres":"경기도 수원시 영통구  삼성로 129 (매탄동)","hm_url":"www.samsung.com/sec","ir_url":"",\
            "phn_no":"02-2255-0114","fax_no":"031-200-7538","induty_code":"264","est_dt":"19690113","acc_mt":"12"}
            """;

    /** 없는 고유번호로 실제로 받은 응답 */
    public static final String NO_DATA = """
            {"status":"013","message":"조회된 데이타가 없습니다."}
            """;

    private CompanyJson() {
    }

    /** 대표자만 바꾼 응답(다시 받은 값이 저장되는지 확인용) */
    public static String withCeo(String ceo) {
        return SAMSUNG.replace("전영현, 노태문", ceo);
    }

    public static String status(String status, String message) {
        return "{\"status\":\"" + status + "\",\"message\":\"" + message + "\"}";
    }
}
