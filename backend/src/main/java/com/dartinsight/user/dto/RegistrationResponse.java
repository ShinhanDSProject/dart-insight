package com.dartinsight.user.dto;

/** 가입한 회원. 비밀번호·토큰은 담지 않고, 가입만 하고 로그인하지 않는다. */
public record RegistrationResponse(long userId, String email) {}
