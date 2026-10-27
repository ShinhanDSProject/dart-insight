package com.dartinsight.season.domain;

import com.dartinsight.analysis.domain.TextChangeRow;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * 시즌 변화 점수(ADR-0037, season-1). 추가·삭제·수정 변경의 확인 우선순위 점수 합을 두 원문 블록 수 평균 1,000개당으로 맞춘다.
 * 숫자만 바뀜·위치 이동·검토 필요는 넣지 않는다. 점수는 바뀐 양이지 좋고 나쁨이 아니다.
 *
 * @param score       점수(소수 둘째 자리)
 * @param changeCount 점수에 넣은 변경 건수
 * @param highlight   최상위 섹션·변경 종류별 점수 합이 큰 두 묶음의 한 줄 요약. 넣은 변경이 없으면 null
 */
public record SeasonScore(BigDecimal score, int changeCount, String highlight) {

    public static final String VERSION = "season-1";

    private static final Set<String> COUNTED = Set.of(TextChangeRow.ADDED, TextChangeRow.DELETED,
            TextChangeRow.MODIFIED);
    private static final int HIGHLIGHT_GROUPS = 2;
    private static final String PATH_SEPARATOR = " > ";
    // 'II. 사업의 내용'의 로마 숫자 번호
    private static final Pattern SECTION_NUMBER = Pattern.compile("^[IVXLC]+\\.\\s*");

    /** 두 원문 블록 수가 모두 0이면 맞출 수 없어 호출하지 않는다 */
    public static SeasonScore of(List<TextChangeRow> rows, int previousBlocks, int currentBlocks) {
        if (previousBlocks + currentBlocks <= 0) {
            throw new IllegalArgumentException("원문 블록 수가 없습니다");
        }
        List<TextChangeRow> counted = rows.stream().filter(row -> COUNTED.contains(row.changeType())).toList();
        long sum = counted.stream().mapToLong(SeasonScore::points).sum();
        // 점수 = 합 ÷ (블록 수 평균 ÷ 1,000) = 합 × 2,000 ÷ (블록 수 합)
        BigDecimal score = BigDecimal.valueOf(sum * 2000L)
                .divide(BigDecimal.valueOf(previousBlocks + currentBlocks), 2, RoundingMode.HALF_UP);
        return new SeasonScore(score, counted.size(), highlight(counted));
    }

    private static long points(TextChangeRow row) {
        Integer score = row.priority() == null ? null : row.priority().score();
        return score == null ? 0 : score;
    }

    private static String highlight(List<TextChangeRow> counted) {
        Map<Group, long[]> groups = new LinkedHashMap<>();
        for (TextChangeRow row : counted) {
            long[] totals = groups.computeIfAbsent(new Group(topSection(row.sectionPath()), row.changeType()),
                    g -> new long[2]);
            totals[0] += points(row);
            totals[1]++;
        }
        if (groups.isEmpty()) {
            return null;
        }
        return groups.entrySet().stream()
                .sorted(Comparator.comparingLong((Map.Entry<Group, long[]> e) -> e.getValue()[0]).reversed())
                .limit(HIGHLIGHT_GROUPS)
                .map(e -> e.getKey().label((int) e.getValue()[1]))
                .collect(Collectors.joining(" · "));
    }

    static String topSection(String sectionPath) {
        if (sectionPath == null || sectionPath.isBlank()) {
            return "그 밖의 섹션";
        }
        int cut = sectionPath.indexOf(PATH_SEPARATOR);
        String top = cut < 0 ? sectionPath : sectionPath.substring(0, cut);
        return SECTION_NUMBER.matcher(top.strip()).replaceFirst("");
    }

    private record Group(String section, String changeType) {

        String label(int count) {
            return switch (changeType) {
                case TextChangeRow.ADDED -> section + " 문단 " + count + "개 추가";
                case TextChangeRow.DELETED -> section + " 문단 " + count + "개 삭제";
                default -> section + " 수정 " + count + "곳";
            };
        }
    }
}
