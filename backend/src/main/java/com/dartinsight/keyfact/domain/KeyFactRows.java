package com.dartinsight.keyfact.domain;

import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.Objects;
import java.util.function.Function;

/**
 * 정기보고서 주요정보 응답의 값 다듬기와 쓸 행 고르기(#350). OpenDART는 사업연도·보고서 코드마다 최신 공시 하나의 값만
 * 주므로 행의 접수번호가 이 보고서와 달라도(뒤에 나온 정정본) 같은 기간의 자료면 쓴다.
 */
public final class KeyFactRows {

    private KeyFactRows() {
    }

    /**
     * 이 보고서 접수번호의 행이 있으면 그 행만, 없으면 첫 행의 접수번호와 같은 행만 고른다. 접수번호가 없는 행은 근거가
     * 없어 쓰지 않는다.
     *
     * @param itemRceptNo 행의 접수번호(rcept_no)
     */
    public static <I> Selected<I> select(String rceptNo, List<I> items, Function<I, String> itemRceptNo) {
        List<I> withRceptNo = items.stream().filter(item -> clean(itemRceptNo.apply(item)) != null).toList();
        if (withRceptNo.isEmpty()) {
            return new Selected<>(null, List.of());
        }
        String source = withRceptNo.stream()
                .map(item -> clean(itemRceptNo.apply(item)))
                .filter(rceptNo::equals)
                .findFirst()
                .orElseGet(() -> clean(itemRceptNo.apply(withRceptNo.get(0))));
        return new Selected<>(source, withRceptNo.stream()
                .filter(item -> source.equals(clean(itemRceptNo.apply(item))))
                .toList());
    }

    /** 결산기준일(stlm_dt)이 없거나 보고서 대상 기간 끝을 모르면 요청한 기간의 응답으로 본다 */
    public static boolean samePeriod(LocalDate settlementDate, LocalDate periodEnd) {
        return settlementDate == null || periodEnd == null || settlementDate.equals(periodEnd);
    }

    /** 원문 값 그대로. 앞뒤 공백만 지우고, '-'·빈 값은 null(없는 값). */
    public static String clean(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.strip();
        return trimmed.isEmpty() || "-".equals(trimmed) ? null : trimmed;
    }

    /** 이름은 짝짓는 기준이라 줄바꿈·연속 공백을 공백 하나로 바꾼다(원문 표의 줄바꿈). */
    public static String name(String value) {
        String cleaned = clean(value);
        return cleaned == null ? null : cleaned.replaceAll("\\s+", " ");
    }

    /** YYYY-MM-DD 날짜. 없거나 읽지 못하면 null */
    public static LocalDate date(String value) {
        String cleaned = clean(value);
        if (cleaned == null) {
            return null;
        }
        try {
            return LocalDate.parse(cleaned);
        } catch (DateTimeParseException e) {
            return null;
        }
    }

    /**
     * 고른 행.
     *
     * @param source 값을 받은 공시의 접수번호. 고른 행이 없으면 null
     * @param items  응답 순서의 행
     */
    public record Selected<I>(String source, List<I> items) {

        /** 이 보고서와 다른 공시(정정본)의 값이면 그 접수번호, 같으면 null */
        public String sourceRceptNo(String rceptNo) {
            return Objects.equals(source, rceptNo) ? null : source;
        }
    }
}
