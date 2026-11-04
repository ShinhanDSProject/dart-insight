package com.dartinsight.agent.domain;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Tool·액션 인자의 JSON Schema 만들기. OpenAI 엄격 구조화 출력(ADR-0026)에 그대로 들어가므로 그 제약 안에서만 쓴다
 * (docs/api-spec.md 3절: type object와 properties, additionalProperties false, 문자열 길이 제약은 쓰지 않음).
 */
public final class Schemas {

    private Schemas() {
    }

    /**
     * @param properties 이름 → 스키마(넣은 순서대로)
     * @param required   꼭 있어야 하는 이름
     */
    public static Map<String, Object> object(Map<String, Object> properties, List<String> required) {
        Map<String, Object> schema = new LinkedHashMap<>();
        schema.put("type", "object");
        schema.put("properties", properties);
        schema.put("required", required);
        schema.put("additionalProperties", false);
        return schema;
    }

    public static Map<String, Object> string(String description) {
        return Map.of("type", "string", "description", description);
    }

    public static Map<String, Object> integer(String description) {
        return Map.of("type", "integer", "description", description);
    }

    public static Map<String, Object> integer(String description, int minimum, int maximum) {
        return Map.of("type", "integer", "description", description, "minimum", minimum, "maximum", maximum);
    }

    public static Map<String, Object> bool(String description) {
        return Map.of("type", "boolean", "description", description);
    }

    public static Map<String, Object> oneOf(String description, List<String> values) {
        return Map.of("type", "string", "description", description, "enum", values);
    }

    public static Map<String, Object> array(String description, Map<String, Object> items) {
        return Map.of("type", "array", "description", description, "items", items);
    }

    /** 넣은 순서를 지키는 properties */
    public static Map<String, Object> properties(Object... nameAndSchema) {
        Map<String, Object> properties = new LinkedHashMap<>();
        for (int i = 0; i + 1 < nameAndSchema.length; i += 2) {
            properties.put((String) nameAndSchema[i], nameAndSchema[i + 1]);
        }
        return properties;
    }
}
