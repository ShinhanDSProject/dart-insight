package com.dartinsight.planinterest.domain;

import java.time.LocalDateTime;
import java.util.Collections;
import java.util.EnumMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 한 기간의 '관심 있어요' 집계(관리자 개요).
 *
 * @param signedIn 로그인한 회원이 남긴 수
 * @param byPlan 요금제별 수. 네 요금제가 늘 키로 있다(없으면 0)
 * @param createdAts 기록마다 누른 시각(날짜별로 셀 때 쓴다)
 */
public record PlanInterestTally(long total, long signedIn, Map<Plan, Long> byPlan, List<LocalDateTime> createdAts) {

    public PlanInterestTally {
        byPlan = Collections.unmodifiableMap(new LinkedHashMap<>(byPlan));
        createdAts = List.copyOf(createdAts);
    }

    public static PlanInterestTally of(List<PlanInterest> interests) {
        Map<Plan, Long> byPlan = new EnumMap<>(Plan.class);
        for (Plan plan : Plan.values()) {
            byPlan.put(plan, 0L);
        }
        interests.forEach(interest -> byPlan.merge(interest.getPlan(), 1L, Long::sum));
        return new PlanInterestTally(interests.size(), interests.stream().filter(PlanInterest::signedIn).count(),
                byPlan, interests.stream().map(PlanInterest::getCreatedAt).toList());
    }
}
