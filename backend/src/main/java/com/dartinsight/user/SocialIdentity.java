package com.dartinsight.user;

public record SocialIdentity(String provider, String providerUserId, String email, boolean emailVerified) {}
