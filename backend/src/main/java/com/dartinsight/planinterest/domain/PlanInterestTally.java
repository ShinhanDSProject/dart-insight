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
 * @param signedInMembers 로그인한 회원·요금제 쌍을 한 번씩만 센 수. 같은 회원이 같은 요금제를 여러 번 눌러도 1이라,
 *     로그인 없이 부풀릴 수 있는 total보다 믿을 만한 수요 신호다
 * @param byPlan 요금제별 수. 네 요금제가 늘 키로 있다(없으면 0)
 * @param createdAts 기록마다 누른 시각(날짜별로 셀 때 쓴다)
 */
public record PlanInterestTally(long total, long signedIn, long signedInMembers, Map<Plan, Long> byPlan,
        List<LocalDateTime> createdAts) {

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
        long signedInMembers = interests.stream()
                .filter(PlanInterest::signedIn)
                .map(interest -> interest.getUserId() + ":" + interest.getPlan())
                .distinct()
                .count();
        return new PlanInterestTally(interests.size(), interests.stream().filter(PlanInterest::signedIn).count(),
                signedInMembers, byPlan, interests.stream().map(PlanInterest::getCreatedAt).toList());
    }
}
