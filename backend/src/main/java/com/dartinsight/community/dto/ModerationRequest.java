package com.dartinsight.community.dto;

/** 관리자 신고 처리. 값은 Object로 받아 타입까지 검증한다(ModerationCommand). */
public record ModerationRequest(Object decision, Object reason, Object blindDays) {}
