package com.dartinsight.outlook.domain;

/**
 * ai-server에 보내는 근거 후보 원문 문단 하나.
 *
 * @param evidenceId  근거 ID({@code {접수번호}#B{블록 번호}})
 * @param sectionPath 상위 목차부터 이은 제목
 * @param text        문단 글(2,000자까지)
 * @param planned     계획·전망 낱말({@link OutlookSources#PLAN_WORDS})이 든 문단인지
 */
public record OutlookSource(String evidenceId, int sectionNo, int blockNo, String sectionPath, String text,
        boolean planned) {

    /** quote가 이 문단 글에 있는지(이어진 공백은 한 칸으로 맞춰 비교) */
    public boolean contains(String quote) {
        String key = OutlookQuote.normalize(quote);
        return !key.isEmpty() && OutlookQuote.normalize(text).contains(key);
    }
}
