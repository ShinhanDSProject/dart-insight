package com.dartinsight.activity.domain;

import java.time.LocalDate;

/**
 * 두 보고서 사이에 낸 공시 한 건(disclosure_window_item의 EVENT 범위 행, ADR-0068).
 *
 * @param type   요청한 공시유형(B·C·E·I·J)
 * @param remark 비고(rm) 원문. 없으면 null
 */
public record PeriodDisclosure(String rceptNo, String type, String reportName, String filerName, LocalDate rceptDt,
        String remark) {

    /** 근거 ID. docs/api-spec.md의 공시 근거와 같다 */
    public String evidenceId() {
        return "D" + rceptNo;
    }
}
