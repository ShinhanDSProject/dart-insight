package com.dartinsight.disclosure.domain;

import java.time.LocalDate;

/**
 * 핵심 수치를 받을 공시 한 건. 최근 공시(FS-51)와 관련 수시공시(3.6)가 함께 쓴다.
 *
 * @param correctedLater 비고 '정'인데 정정본을 모르는 원본(관련 수시공시의 기간 뒤에 정정됨). 원본 접수일 하루로 불러 그 종류의
 *                       행이 하나뿐이면 그 행(최신 정정본)을 쓴다
 */
public record KeyItemTarget(String rceptNo, String reportName, LocalDate rceptDt, KeyItemKind kind,
        boolean correctedLater) {
}
