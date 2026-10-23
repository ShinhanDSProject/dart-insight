package com.dartinsight.report.domain;

/**
 * DART 원문 주소. 접수번호로 해당 보고서 원문을 연다.
 */
public final class DartLinks {

    private static final String VIEWER = "https://dart.fss.or.kr/dsaf001/main.do?rcpNo=";

    private DartLinks() {
    }

    public static String viewer(String rceptNo) {
        return VIEWER + rceptNo;
    }
}
