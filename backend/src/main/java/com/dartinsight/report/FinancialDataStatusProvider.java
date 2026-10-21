package com.dartinsight.report;

import java.util.List;
import java.util.Map;

/**
 * 보고서별 재무 자료 상태. 재무제표를 받는 쪽(financial 패키지, 4.5)이 구현한다.
 */
public interface FinancialDataStatusProvider {

    /** @return 접수번호 → 상태. 모든 보고서가 들어 있다 */
    Map<String, FinancialDataStatus> statuses(String corpCode, List<Report> reports);
}
