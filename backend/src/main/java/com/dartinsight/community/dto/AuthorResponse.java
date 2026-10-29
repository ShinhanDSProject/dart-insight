package com.dartinsight.community.dto;

/** 작성자는 닉네임과 '내 글인지'만 내보낸다(이메일·사용자 ID 없음). */
public record AuthorResponse(String nickname, boolean mine) {}
