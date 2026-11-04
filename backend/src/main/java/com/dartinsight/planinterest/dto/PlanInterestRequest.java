package com.dartinsight.planinterest.dto;

/** 요금제 '관심 있어요'(POST /api/plan-interests). 값은 Object로 받아 타입까지 검증한다(PlanInterest.record). */
public record PlanInterestRequest(Object plan, Object source) {}
