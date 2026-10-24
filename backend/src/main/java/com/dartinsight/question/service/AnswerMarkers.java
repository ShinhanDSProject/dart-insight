package com.dartinsight.question.service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 답 안의 근거 표시를 화면용 번호로 바꾼다. {@code [근거 ID]}는 처음 나온 순서대로 {@code [1]}, {@code [2]}…로,
 * 사실 표시 {@code [F1]}은 그대로 둔다. 보낸 적 없는 근거 ID·사실 ref가 하나라도 있거나 표시가 하나도 없으면
 * 확인하지 못한 답으로 본다.
 */
final class AnswerMarkers {

    private static final Pattern MARKER = Pattern.compile("\\[([^\\[\\]]+)]");
    private static final Pattern FACT_REF = Pattern.compile("F(\\d+)");
    private static final Pattern SEPARATOR = Pattern.compile("[,\\s]+");

    private AnswerMarkers() {
    }

    /**
     * @param evidenceIds 후보로 보낸 근거 ID
     * @param factRefs    보낸 사실 ref
     */
    static Converted convert(String answer, Set<String> evidenceIds, Set<String> factRefs) {
        if (answer == null || answer.isBlank()) {
            return Converted.invalid();
        }
        Set<String> cited = new LinkedHashSet<>();
        Set<String> facts = new LinkedHashSet<>();
        StringBuilder out = new StringBuilder();
        Matcher matcher = MARKER.matcher(answer);
        int markers = 0;
        while (matcher.find()) {
            StringBuilder replacement = new StringBuilder();
            for (String part : SEPARATOR.split(matcher.group(1).trim())) {
                if (part.isEmpty()) {
                    continue;
                }
                if (factRefs.contains(part)) {
                    facts.add(part);
                    replacement.append('[').append(part).append(']');
                } else if (evidenceIds.contains(part)) {
                    cited.add(part);
                    replacement.append('[').append(new ArrayList<>(cited).indexOf(part) + 1).append(']');
                } else {
                    return Converted.invalid();
                }
                markers++;
            }
            matcher.appendReplacement(out, Matcher.quoteReplacement(replacement.toString()));
        }
        matcher.appendTail(out);
        if (markers == 0) {
            return Converted.invalid();
        }
        return new Converted(true, out.toString(), List.copyOf(cited), sortedRefs(facts));
    }

    /** 답에 나온 사실 ref(F 뒤 번호 순서). 저장된 답에서 사실을 다시 짝지을 때도 쓴다 */
    static List<String> factRefs(String convertedAnswer) {
        Set<String> refs = new LinkedHashSet<>();
        if (convertedAnswer != null) {
            Matcher matcher = MARKER.matcher(convertedAnswer);
            while (matcher.find()) {
                if (FACT_REF.matcher(matcher.group(1)).matches()) {
                    refs.add(matcher.group(1));
                }
            }
        }
        return sortedRefs(refs);
    }

    private static List<String> sortedRefs(Set<String> refs) {
        return refs.stream().sorted(Comparator.comparingInt(AnswerMarkers::refNo)).toList();
    }

    private static int refNo(String ref) {
        Matcher matcher = FACT_REF.matcher(ref);
        return matcher.matches() ? Integer.parseInt(matcher.group(1)) : Integer.MAX_VALUE;
    }

    /**
     * @param evidenceIds 인용 번호 순서의 근거 ID
     * @param factRefs    인용한 사실 ref(번호 순서)
     */
    record Converted(boolean valid, String answer, List<String> evidenceIds, List<String> factRefs) {

        static Converted invalid() {
            return new Converted(false, null, List.of(), List.of());
        }
    }
}
