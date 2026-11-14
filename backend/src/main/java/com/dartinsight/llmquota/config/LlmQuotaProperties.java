package com.dartinsight.llmquota.config;

import com.dartinsight.llmquota.domain.QuotaKind;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * 하루 LLM 호출 한도(ADR-0054·0056). 하루는 한국 시간 0시에 바뀐다.
 *
 * @param anonymousPerDay 로그인하지 않은 클라이언트 IP 하나의 하루 질문·채팅 횟수
 * @param memberPerDay 회원 한 명의 하루 질문·채팅 횟수
 * @param totalPerDay 서비스 전체 하루 질문·채팅 횟수(비용 상한)
 * @param analysisAnonymousPerDay 로그인하지 않은 IP 하나가 하루에 새로 만들 수 있는 분석 수
 * @param analysisMemberPerDay 회원 한 명이 하루에 새로 만들 수 있는 분석 수
 * @param analysisTotalPerDay 서비스 전체가 하루에 사용자 요청으로 새로 만드는 분석 수
 * @param explanationAnonymousPerDay 로그인하지 않은 IP 하나가 하루에 새로 만들 수 있는 문장 변경 한 줄 풀이 수(ADR-0069)
 * @param explanationMemberPerDay 회원 한 명이 하루에 새로 만들 수 있는 한 줄 풀이 수
 * @param explanationTotalPerDay 서비스 전체가 하루에 새로 만드는 한 줄 풀이 수
 */
@ConfigurationProperties(prefix = "app.llm-quota")
public record LlmQuotaProperties(
        @DefaultValue("true") boolean enabled,
        @DefaultValue("20") int anonymousPerDay,
        @DefaultValue("100") int memberPerDay,
        @DefaultValue("3000") int totalPerDay,
        @DefaultValue("10") int analysisAnonymousPerDay,
        @DefaultValue("30") int analysisMemberPerDay,
        @DefaultValue("500") int analysisTotalPerDay,
        @DefaultValue("30") int explanationAnonymousPerDay,
        @DefaultValue("150") int explanationMemberPerDay,
        @DefaultValue("3000") int explanationTotalPerDay) {

    /** 종류별 한도 */
    public Limits limits(QuotaKind kind) {
        return switch (kind) {
            case QUESTION -> new Limits(anonymousPerDay, memberPerDay, totalPerDay);
            case ANALYSIS -> new Limits(analysisAnonymousPerDay, analysisMemberPerDay, analysisTotalPerDay);
            case EXPLANATION -> new Limits(explanationAnonymousPerDay, explanationMemberPerDay, explanationTotalPerDay);
        };
    }

    /** 비로그인·회원·전체 하루 한도 */
    public record Limits(int anonymous, int member, int total) {

        public int caller(boolean isMember) {
            return isMember ? member : anonymous;
        }
    }
}
