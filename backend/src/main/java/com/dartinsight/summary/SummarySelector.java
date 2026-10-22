package com.dartinsight.summary;

import com.dartinsight.analysis.CalcStatus;
import com.dartinsight.analysis.FinancialChangeRow;
import com.dartinsight.analysis.TextChangeRow;
import com.dartinsight.document.DocumentBlock;
import com.dartinsight.document.DocumentSection;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 요약할 변화 고르기(3.2). 고르는 일은 코드가 한다(LLM에 맡기지 않음).
 * <ul>
 *   <li>재무 수치: 계산한 계정 중 손익계산서에서 증감액이 큰 3개, 재무상태표에서 2개</li>
 *   <li>문장 변화: 우선순위(2.6) 높음·중간 중 점수가 높은 5개(숫자만 바뀐 것과 검토 필요는 뺌)</li>
 *   <li>설명 후보: 현재 보고서의 경영진단·사업의 내용 섹션 문단 중 그 계정 이름이 나오는 앞의 2개</li>
 * </ul>
 */
public final class SummarySelector {

    static final int INCOME_ITEMS = 3;
    static final int BALANCE_ITEMS = 2;
    static final int TEXT_ITEMS = 5;
    static final int CANDIDATES = 2;
    static final int MAX_CANDIDATE_CHARS = 1500;
    private static final List<String> EXPLAINING_SECTIONS = List.of("경영진단", "사업의내용");

    private SummarySelector() {
    }

    /** 고른 재무 수치 결과의 목록 안 순서 */
    public static List<Integer> financial(List<FinancialChangeRow> rows) {
        List<Integer> picked = new ArrayList<>(top(rows, "IS", INCOME_ITEMS));
        picked.addAll(top(rows, "BS", BALANCE_ITEMS));
        return picked;
    }

    private static List<Integer> top(List<FinancialChangeRow> rows, String sjDiv, int count) {
        List<Integer> indexes = new ArrayList<>();
        for (int i = 0; i < rows.size(); i++) {
            FinancialChangeRow row = rows.get(i);
            if (sjDiv.equals(row.sjDiv()) && row.calcStatus() == CalcStatus.OK && row.changeAmount() != null
                    && row.changeAmount() != 0 && row.previousAmount() != null && row.currentAmount() != null) {
                indexes.add(i);
            }
        }
        indexes.sort(Comparator.comparingLong((Integer i) -> -Math.abs(rows.get(i).changeAmount()))
                .thenComparing(i -> i));
        return indexes.subList(0, Math.min(count, indexes.size()));
    }

    /** 고른 문장 변화의 목록 안 순서 */
    public static List<Integer> text(List<TextChangeRow> rows) {
        List<Integer> indexes = new ArrayList<>();
        for (int i = 0; i < rows.size(); i++) {
            TextChangeRow row = rows.get(i);
            if (row.priority() != null && ("HIGH".equals(row.priority().level())
                    || "MEDIUM".equals(row.priority().level())) && !row.numbersOnly()
                    && !TextChangeRow.REVIEW_NEEDED.equals(row.changeType())) {
                indexes.add(i);
            }
        }
        indexes.sort(Comparator.comparingInt((Integer i) -> -rows.get(i).priority().score()).thenComparing(i -> i));
        return indexes.subList(0, Math.min(TEXT_ITEMS, indexes.size()));
    }

    /** 계정 이름이 나오는 설명 후보 문단(현재 보고서). 원문이 없으면 빈 목록 */
    public static List<SummaryAiRequest.Source> candidates(String accountName, List<DocumentSection> sections,
            List<DocumentBlock> blocks) {
        String name = compact(accountName);
        if (name.isEmpty()) {
            return List.of();
        }
        Map<Integer, String> paths = paths(sections);
        List<SummaryAiRequest.Source> found = new ArrayList<>();
        for (DocumentBlock block : blocks) {
            String path = paths.getOrDefault(block.sectionNo(), "");
            String compactPath = compact(path);
            if (!DocumentBlock.PARAGRAPH.equals(block.type())
                    || EXPLAINING_SECTIONS.stream().noneMatch(compactPath::contains)
                    || !compact(block.text()).contains(name)) {
                continue;
            }
            String text = block.text().length() <= MAX_CANDIDATE_CHARS ? block.text()
                    : block.text().substring(0, MAX_CANDIDATE_CHARS);
            found.add(new SummaryAiRequest.Source(block.evidenceId(), path, text));
            if (found.size() == CANDIDATES) {
                break;
            }
        }
        return found;
    }

    static String compact(String text) {
        return text == null ? "" : text.replaceAll("\\s+", "");
    }

    static Map<Integer, String> paths(List<DocumentSection> sections) {
        Map<Integer, DocumentSection> byNo = new HashMap<>();
        sections.forEach(s -> byNo.put(s.sectionNo(), s));
        Map<Integer, String> paths = new HashMap<>();
        for (DocumentSection section : sections) {
            StringBuilder path = new StringBuilder(section.title());
            Integer parent = section.parentNo();
            for (int guard = 0; parent != null && byNo.containsKey(parent) && guard < 20; guard++) {
                path.insert(0, byNo.get(parent).title() + " > ");
                parent = byNo.get(parent).parentNo();
            }
            paths.put(section.sectionNo(), path.toString());
        }
        return paths;
    }
}
