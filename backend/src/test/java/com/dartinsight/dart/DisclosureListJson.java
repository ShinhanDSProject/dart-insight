package com.dartinsight.dart;

/**
 * 테스트용 공시검색(list.json) 응답 JSON. 회사와 공시는 모두 가짜다.
 */
public final class DisclosureListJson {

    public static final String RATE_LIMITED = "{\"status\":\"020\",\"message\":\"요청 제한을 초과하였습니다.\"}";
    public static final String NO_DATA = "{\"status\":\"013\",\"message\":\"조회된 데이타가 없습니다.\"}";

    private DisclosureListJson() {
    }

    public static String page(int pageNo, int totalPage, String... items) {
        return """
                {"status":"000","message":"정상","page_no":%d,"page_count":100,"total_count":%d,"total_page":%d,
                 "list":[%s]}
                """.formatted(pageNo, items.length, totalPage, String.join(",", items));
    }

    public static String item(String rceptNo, String reportName, String rceptDt, String rm) {
        return """
                {"corp_code":"00000001","corp_name":"예시전자","stock_code":"900001","corp_cls":"Y",
                 "report_nm":"%s","rcept_no":"%s","flr_nm":"예시전자","rcept_dt":"%s","rm":"%s"}
                """.formatted(reportName, rceptNo, rceptDt, rm);
    }
}
