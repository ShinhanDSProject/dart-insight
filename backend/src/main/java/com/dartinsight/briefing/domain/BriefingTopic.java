package com.dartinsight.briefing.domain;

/**
 * 브리핑 근거의 주제. 'II. 사업의 내용'의 하위 목차 제목으로 정한다(ADR-0025). 값은 ai-server app/briefing/model.py와 같다.
 */
public enum BriefingTopic {
    OVERVIEW, PRODUCTS, SALES, RISK
}
