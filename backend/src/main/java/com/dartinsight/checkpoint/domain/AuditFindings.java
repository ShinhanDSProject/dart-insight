package com.dartinsight.checkpoint.domain;

import com.dartinsight.disclosure.domain.Disclosure;
import com.dartinsight.disclosure.domain.GoingConcernFinding;
import java.util.List;

/**
 * 감사의견 항목에 쓰는 확인해 볼 공시의 결과.
 *
 * @param nonClean     적정이 아닌 감사의견이 적힌 사업보고서
 * @param goingConcern 당기 강조사항 등·특기사항에 계속기업 문구가 있는 사업보고서(#546, 접수일이 최근인 순서)
 */
public record AuditFindings(List<Disclosure> nonClean, List<GoingConcernFinding> goingConcern) {

    public AuditFindings {
        nonClean = List.copyOf(nonClean);
        goingConcern = List.copyOf(goingConcern);
    }
}
