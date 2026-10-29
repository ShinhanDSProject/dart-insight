package com.dartinsight.summary.domain;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 한 기간의 LLM 호출 집계(AI 사용 현황, FS-15·FS-50). 다시 만든 호출도 한 번씩 센다.
 *
 * @param byOutcome 결과별 호출 수. {@link #OUTCOMES}가 늘 앞에 키로 있고(없으면 0), 그 밖의 값이 기록돼 있으면 그 값도 들어간다
 * @param byTask 작업별 호출 수와 토큰 합(작업 이름 순서)
 * @param byModel 제공자·모델별 호출 수와 토큰 합(제공자, 모델 이름 순서)
 * @param analyses 기간 안에 호출이 있는 분석(analysis_id)들의 수와 모델별 토큰 합
 * @param briefings 기간 안에 호출이 있는 기업 브리핑(company_briefing_id)들의 수와 모델별 토큰 합
 * @param outlooks 기간 안에 호출이 있는 전망·계획(company_outlook_id, FS-59)들의 수와 모델별 토큰 합
 * @param planFollowups 기간 안에 호출이 있는 약속과 실제 대조(plan_followup_id, FS-60)들의 수와 모델별 토큰 합
 */
public record LlmCallUsage(Map<String, Long> byOutcome, List<TaskUsage> byTask, List<ModelUsage> byModel,
        UnitUsage analyses, UnitUsage briefings, UnitUsage outlooks, UnitUsage planFollowups) {

    /** llm_call.outcome으로 기록하는 값(docs/erd.md) */
    public static final List<String> OUTCOMES = List.of("OK", "INVALID_OUTPUT", "TRANSIENT_ERROR", "ERROR");

    public LlmCallUsage {
        byOutcome = Collections.unmodifiableMap(new LinkedHashMap<>(byOutcome));
        byTask = List.copyOf(byTask);
        byModel = List.copyOf(byModel);
    }

    /**
     * 작업 하나의 집계.
     *
     * @param inputTokens 제공자가 알려 준 호출의 입력 토큰 합. 그 작업의 호출이 모두 토큰을 모르면 null
     * @param outputTokens 출력 토큰 합. 위와 같다
     */
    public record TaskUsage(String task, long calls, Long inputTokens, Long outputTokens) {
    }

    /** 제공자·모델 하나의 집계. 토큰이 null인 규칙은 {@link TaskUsage}와 같다 */
    public record ModelUsage(String provider, String model, long calls, Long inputTokens, Long outputTokens,
            List<TaskUsage> byTask) {

        public ModelUsage {
            byTask = List.copyOf(byTask);
        }
    }

    /**
     * 작업 단위(분석·브리핑·전망·대조) 묶음의 집계.
     *
     * @param count 기간 안에 호출이 하나라도 있는 단위 수
     * @param byModel 그 단위들의 호출을 제공자·모델별로 더한 토큰 합(비용은 모델 가격으로 따로 계산한다)
     */
    public record UnitUsage(long count, List<ModelTokens> byModel) {

        public UnitUsage {
            byModel = List.copyOf(byModel);
        }
    }

    /** 제공자·모델 하나의 토큰 합. 그 모델의 호출이 모두 토큰을 모르면 null */
    public record ModelTokens(String provider, String model, Long inputTokens, Long outputTokens) {
    }
}
