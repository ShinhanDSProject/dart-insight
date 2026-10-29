package com.dartinsight.community.dto;

/** 글 쓰기·고치기, 댓글 고치기. Object로 받아 숫자·배열을 문자열로 강제 변환하지 않고 검증한다. */
public record CommunityBodyRequest(Object body) {}
