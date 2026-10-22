package com.dartinsight.dart;

/**
 * OpenDART 외부 API 경로. {@link OpenDartClient}가 부르는 경로는 여기에만 둔다.
 */
public final class OpenDartPaths {

    public static final String CORP_CODE = "/api/corpCode.xml";
    public static final String DISCLOSURE_LIST = "/api/list.json";
    public static final String FINANCIAL_STATEMENTS = "/api/fnlttSinglAcntAll.json";
    public static final String DOCUMENT = "/api/document.xml";

    private OpenDartPaths() {
    }
}
