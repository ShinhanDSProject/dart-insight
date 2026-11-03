package com.dartinsight.agent.domain;

import java.util.Collection;
import java.util.Map;
import java.util.Set;

/**
 * ai-server가 고른 Tool 인자 읽기. 형식이 맞지 않으면 {@link IllegalArgumentException}(짧은 사유)을 던지고,
 * 부른 쪽은 Tool을 실행하지 않고 그 사유를 실패한 Tool 결과로 돌려준다(ADR-0044). null은 없는 값으로 본다
 * (엄격 구조화 출력은 필수가 아닌 인자를 null로 채움).
 */
public final class ToolArgs {

    private final Map<String, Object> values;

    private ToolArgs(Map<String, Object> values) {
        this.values = values;
    }

    /** 허용한 이름 밖의 인자가 있으면 실패 */
    public static ToolArgs of(Map<String, Object> values, Set<String> allowed) {
        Map<String, Object> args = values == null ? Map.of() : values;
        for (String name : args.keySet()) {
            if (!allowed.contains(name)) {
                throw new IllegalArgumentException("모르는 인자입니다: " + name);
            }
        }
        return new ToolArgs(args);
    }

    public String string(String name) {
        Object value = values.get(name);
        if (value == null) {
            return null;
        }
        if (!(value instanceof String text)) {
            throw new IllegalArgumentException(name + "는 문자열이어야 합니다.");
        }
        String stripped = text.strip();
        return stripped.isEmpty() ? null : stripped;
    }

    /** 정해진 값 중 하나. 없으면 fallback */
    public String choice(String name, Collection<String> allowed, String fallback) {
        String value = string(name);
        if (value == null) {
            return fallback;
        }
        if (!allowed.contains(value)) {
            throw new IllegalArgumentException(name + "는 " + allowed + " 중 하나여야 합니다.");
        }
        return value;
    }

    public boolean flag(String name) {
        Object value = values.get(name);
        if (value == null) {
            return false;
        }
        if (!(value instanceof Boolean flag)) {
            throw new IllegalArgumentException(name + "는 true·false여야 합니다.");
        }
        return flag;
    }

    /** min~max 정수. 없으면 fallback */
    public int integer(String name, int min, int max, int fallback) {
        Long value = number(name);
        if (value == null) {
            return fallback;
        }
        if (value < min || value > max) {
            throw new IllegalArgumentException(name + "는 " + min + "~" + max + "이어야 합니다.");
        }
        return value.intValue();
    }

    /** 꼭 있어야 하는 ID */
    public long requiredId(String name) {
        Long value = number(name);
        if (value == null) {
            throw new IllegalArgumentException(name + "가 없습니다.");
        }
        return value;
    }

    private Long number(String name) {
        Object value = values.get(name);
        if (value == null) {
            return null;
        }
        if (value instanceof Integer || value instanceof Long) {
            return ((Number) value).longValue();
        }
        throw new IllegalArgumentException(name + "는 정수여야 합니다.");
    }
}
