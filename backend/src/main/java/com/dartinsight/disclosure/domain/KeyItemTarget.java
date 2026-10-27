package com.dartinsight.disclosure.domain;

import java.time.LocalDate;

/**
 * 핵심 수치를 받을 공시 한 건. 최근 공시(FS-51)와 관련 수시공시(3.6)가 함께 쓴다.
 *
 * @param correctedLater 비고 '정'인 원본({@link KeyItemRules#correctedLater}). 원본 접수일 하루로 불러 그 종류의 행이 하나뿐이면
 *                       그 행(최신 정정본)을 쓴다
 */
public record KeyItemTarget(String rceptNo, String reportName, LocalDate rceptDt, KeyItemKind kind,
        boolean correctedLater) {

    /**
     * 공시 목록 값으로 만든다. 핵심 수치는 접수번호로만 저장하므로, 먼저 부른 기능에 따라 저장 값이 달라지지 않게 두 기능 모두 이
     * 팩터리로 만든다.
     *
     * @param remark 비고(rm) 원문. 없으면 null
     */
    public static KeyItemTarget of(String rceptNo, String reportName, LocalDate rceptDt, KeyItemKind kind,
            String remark) {
        return new KeyItemTarget(rceptNo, reportName, rceptDt, kind,
                KeyItemRules.correctedLater(reportName, remark));
    }
}
