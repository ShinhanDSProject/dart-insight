package com.dartinsight.followup.domain;

import com.dartinsight.outlook.domain.OutlookItem;
import com.dartinsight.outlook.domain.OutlookQuote;

/**
 * 계획 하나에 보내는 올해 보고서 후보 문단(ADR-0041).
 *
 * @param evidenceId  근거 ID({@code {접수번호}#B{블록 번호}})
 * @param sectionPath 상위 목차부터 이은 제목
 * @param text        문단 글(2,000자까지)
 */
public record PlanCandidate(String evidenceId, String rceptNo, int sectionNo, int blockNo, String sectionPath,
        String text) {

    /** quote가 이 문단 글에 있는지(이어진 공백은 한 칸으로 맞춰 비교) */
    public boolean contains(String quote) {
        String key = OutlookQuote.normalize(quote);
        return !key.isEmpty() && OutlookQuote.normalize(text).contains(key);
    }

    public OutlookItem.Evidence evidence() {
        return new OutlookItem.Evidence(evidenceId, rceptNo, sectionNo, blockNo, sectionPath);
    }
}
