package com.dartinsight.user.domain;

/**
 * 관리자 화면에 보이는 이메일 가리기(docs/api-spec.md GET /api/admin/users). 전체 이메일은 응답·로그에 넣지 않는다.
 * 아이디 앞 2자(2자 이하면 1자) + ***, @, 도메인 첫 글자 + ***, 마지막 점 뒤 끝말(예: tjdals@gmail.com → tj***@g***.com).
 */
public final class EmailMask {
    private static final String STARS = "***";

    private EmailMask() {
    }

    /** 이메일이 없으면 null. '@' 앞이나 뒤가 비어 있으면 모두 가린다(***) */
    public static String mask(String email) {
        if (email == null || email.isBlank()) return null;
        int at = email.lastIndexOf('@');
        if (at <= 0 || at == email.length() - 1) return STARS;
        String local = email.substring(0, at);
        String domain = email.substring(at + 1);
        int dot = domain.lastIndexOf('.');
        String suffix = dot > 0 ? domain.substring(dot) : "";
        return local.substring(0, local.length() <= 2 ? 1 : 2) + STARS + "@" + domain.charAt(0) + STARS + suffix;
    }
}
