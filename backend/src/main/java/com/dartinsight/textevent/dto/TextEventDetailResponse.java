package com.dartinsight.textevent.dto;

import com.dartinsight.analysis.dto.TextChangeItemResponse;
import com.dartinsight.textevent.service.TextEventQueryService.EventDetail;
import com.fasterxml.jackson.annotation.JsonUnwrapped;
import java.util.List;

/**
 * 주요 사건 하나와 묶인 변경. changes의 모양은 API 약속상 text-changes 목록 항목과 같아야 해서 그 응답 record를 그대로 쓴다.
 */
public record TextEventDetailResponse(@JsonUnwrapped TextEventItemResponse event,
        List<TextChangeItemResponse> changes) {

    public static TextEventDetailResponse from(EventDetail detail) {
        return new TextEventDetailResponse(TextEventItemResponse.of(detail.event(), detail.changes()),
                detail.event().row().changeNos().stream()
                        .map(no -> TextChangeItemResponse.from(detail.changes().get(no))).toList());
    }
}
