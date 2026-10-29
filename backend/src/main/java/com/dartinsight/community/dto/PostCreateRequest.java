package com.dartinsight.community.dto;

/**
 * POST /api/companies/{corpCode}/posts. quote는 붙일 변경점({kind, analysisId, changeId})이고 없어도 된다.
 * Object로 받아 숫자 문자열 같은 값을 강제 변환하지 않고 검증한다.
 */
public record PostCreateRequest(Object body, Object quote) {}
