package com.dartinsight.community.dto;

/** 관리자 신고 목록의 작성자·관리자. 닉네임만 내보낸다(이메일·사용자 ID 없음). */
public record MemberResponse(String nickname) {}
