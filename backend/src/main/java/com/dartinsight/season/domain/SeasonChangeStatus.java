package com.dartinsight.season.domain;

/** SCORED 점수 매김, NO_REPORT 그 시즌·전년 보고서 없음, FAILED 문장 비교 실패·일부만 비교 */
public enum SeasonChangeStatus {
    SCORED, NO_REPORT, FAILED
}
