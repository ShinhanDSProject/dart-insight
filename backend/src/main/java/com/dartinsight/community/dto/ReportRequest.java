package com.dartinsight.community.dto;

/** 글·댓글 신고. 사유는 Object로 받아 허용 값인지 검증한다(API 명세 6.6 신고). */
public record ReportRequest(Object reason) {}
