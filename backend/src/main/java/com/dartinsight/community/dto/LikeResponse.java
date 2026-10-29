package com.dartinsight.community.dto;

/** PUT·DELETE …/like. 누른 뒤(또는 취소한 뒤)의 지금 상태 */
public record LikeResponse(boolean liked, int likeCount) {}
