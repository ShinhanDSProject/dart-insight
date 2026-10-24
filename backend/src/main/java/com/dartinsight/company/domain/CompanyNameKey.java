package com.dartinsight.company.domain;

import java.util.Locale;

/**
 * 기업 검색용 회사명 정규화(1.1, docs/erd.md company). 순수 함수만 둔다.
 * key: 공백을 모두 빼고 소문자로 바꾼 이름. chosung: key의 한글 음절을 초성으로 바꾼 값.
 */
public final class CompanyNameKey {

    private static final char[] INITIALS = {
        'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'};
    private static final char SYLLABLE_FIRST = '가';
    private static final char SYLLABLE_LAST = '힣';
    /** 초성 하나에 붙는 음절 수(중성 21 × 종성 28). */
    private static final int SYLLABLES_PER_INITIAL = 21 * 28;
    /** 한글 호환 자모 가운데 자음(ㄱ~ㅎ, U+3131~U+314E). */
    private static final char CONSONANT_FIRST = 'ㄱ';
    private static final char CONSONANT_LAST = 'ㅎ';
    private static final int MIN_CHOSUNG_QUERY_LENGTH = 2;

    private CompanyNameKey() {
    }

    /** 공백(줄 바꿈·전각 공백·줄 바꿈 없는 공백 포함)을 모두 빼고 소문자로 바꾼다. null이면 null. */
    public static String key(String name) {
        if (name == null) {
            return null;
        }
        StringBuilder sb = new StringBuilder(name.length());
        name.codePoints().filter(cp -> !isSpace(cp)).forEach(sb::appendCodePoint);
        return sb.toString().toLowerCase(Locale.ROOT);
    }

    /** key의 한글 음절(가~힣)을 초성으로 바꾼다. 다른 글자는 그대로 둔다. null이면 null. */
    public static String chosung(String name) {
        String key = key(name);
        if (key == null) {
            return null;
        }
        StringBuilder sb = new StringBuilder(key.length());
        for (char c : key.toCharArray()) {
            sb.append(c >= SYLLABLE_FIRST && c <= SYLLABLE_LAST
                    ? INITIALS[(c - SYLLABLE_FIRST) / SYLLABLES_PER_INITIAL]
                    : c);
        }
        return sb.toString();
    }

    /** 공백을 뺀 검색어가 한글 자음(ㄱ~ㅎ)만으로 2자 이상이면 초성 검색어다. */
    public static boolean isChosungQuery(String query) {
        String key = key(query);
        return key != null && key.length() >= MIN_CHOSUNG_QUERY_LENGTH
                && key.chars().allMatch(c -> c >= CONSONANT_FIRST && c <= CONSONANT_LAST);
    }

    private static boolean isSpace(int codePoint) {
        return Character.isWhitespace(codePoint) || Character.isSpaceChar(codePoint);
    }
}
