package com.dartinsight.question.dto;

import com.dartinsight.question.dto.CompanyQuestionResponse.ReportRef;
import java.util.List;

/**
 * 지금 대상 보고서에 한 기업 질문 기록(최신 순, 최대 20개).
 *
 * @param report 대상 보고서. 정기보고서가 없으면 null
 */
public record CompanyQuestionListResponse(ReportRef report, List<CompanyQuestionResponse> items) {
}
