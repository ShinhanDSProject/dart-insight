package com.dartinsight.user.dto;

/** Object로 받아 숫자·배열을 문자열로 강제 변환하지 않고 검증한다(RegistrationRequest와 같음). */
public record NicknameRequest(Object nickname) {}
