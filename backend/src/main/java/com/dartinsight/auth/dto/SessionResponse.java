package com.dartinsight.auth.dto;

public record SessionResponse(long userId, String accessToken, long expiresIn) {
}
