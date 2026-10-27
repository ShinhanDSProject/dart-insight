package com.dartinsight.summary.service;

import com.dartinsight.analysis.domain.CalcStatus;
import com.dartinsight.analysis.domain.FinancialChangeRow;
import com.dartinsight.analysis.domain.TextChangeRow;
import com.dartinsight.document.domain.DocumentBlock;
import com.dartinsight.document.domain.DocumentSection;
import com.dartinsight.summary.dto.SummaryAiRequest;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 요약할 변화 고르기(3.2). 고르는 일은 코드가 한다(LLM에 맡기지 않음).
 * <ul>
 *   <li>재무 수치: 계산한 계정 중 손익계산서에서 증감액이 큰 3개(손익계산서 없이 포괄손익계산서 하나로 낸 회사는
 *   포괄손익계산서에서), 재무상태표에서 2개. 같은 재무제표에서 이미 고른 계정과 이전·현재 금액이 모두 같은 계정(예:
 *   자산총계와 부채와자본총계)은 건너뛰고 다음 계정으로 채운다</li>
 *   <li>문장 변화: 우선순위(2.6) 높음·중간 중 점수가 높은 5개(숫자만 바뀜·위치 이동·검토 필요는 뺌)</li>
 *   <li>설명 후보: 현재 보고서의 경영진단·사업의 내용 섹션 문단 중 그 계정의 검색어(AccountAliases)가 하나라도
 *   나오는 앞의 2개</li>
 * </ul>
 */
public final class SummarySelector {

    static final int INCOME_ITEMS = 3;
    static final int BALANCE_ITEMS = 2;
    static final int TEXT_ITEMS = 5;
    /** 요약하지 않는 문장 변화: 숫자만 바뀜(재무 수치와 겹침), 위치 이동(내용 그대로), 검토 필요(짝 없음) */
    static final Set<String> EXCLUDED_TEXT_TYPES = Set.of(TextChangeRow.NUMERIC_UPDATE, TextChangeRow.MOVED,
            TextChangeRow.REVIEW_NEEDED);
    static final int CANDIDATES = 2;
    static final int MAX_CANDIDATE_CHARS = 1500;
    private static final List<String> EXPLAINING_SECTIONS = List.of("경영진단", "사업의내용");

    private SummarySelector() {
    }

    /** 고른 재무 수치 결과의 목록 안 순서 */
    public static List<Integer> financial(List<FinancialChangeRow> rows) {
        List<Integer> income = top(rows, "IS", INCOME_ITEMS);
        List<Integer> picked = new ArrayList<>(income.isEmpty() ? top(rows, "CIS", INCOME_ITEMS) : income);
        picked.addAll(top(rows, "BS", BALANCE_ITEMS));
        return picked;
    }

    private static List<Integer> top(List<FinancialChangeRow> rows, String sjDiv, int count) {
        List<Integer> indexes = new ArrayList<>();
        for (int i = 0; i < rows.size(); i++) {
            FinancialChangeRow row = rows.get(i);
            // 증감률을 계산한 계정과 이익 계정의 흑자·적자 상태만 요약한다(부호만 바뀐 그 밖의 계정은 빼기, #144)
            boolean summarizable = row.calcStatus() == CalcStatus.OK || row.calcStatus().profitState();
            if (sjDiv.equals(row.sjDiv()) && summarizable && row.changeAmount() != null
                    && row.changeAmount() != 0 && row.previousAmount() != null && row.currentAmount() != null) {
                indexes.add(i);
            }
        }
        indexes.sort(Comparator.comparingLong((Integer i) -> -Math.abs(rows.get(i).changeAmount()))
                .thenComparing(i -> i));
        List<Integer> picked = new ArrayList<>();
        for (int i : indexes) {
            if (picked.size() == count) {
                break;
            }
            FinancialChangeRow row = rows.get(i);
            boolean sameAmounts = picked.stream().map(rows::get)
                    .anyMatch(p -> p.previousAmount().equals(row.previousAmount())
                            && p.currentAmount().equals(row.currentAmount()));
            if (!sameAmounts) {
                picked.add(i);
            }
        }
        return picked;
    }

    /** 고른 문장 변화의 목록 안 순서 */
    public static List<Integer> text(List<TextChangeRow> rows) {
        List<Integer> indexes = new ArrayList<>();
        for (int i = 0; i < rows.size(); i++) {
            TextChangeRow row = rows.get(i);
            if (row.priority() != null && ("HIGH".equals(row.priority().level())
                    || "MEDIUM".equals(row.priority().level())) && !EXCLUDED_TEXT_TYPES.contains(row.changeType())) {
                indexes.add(i);
            }
        }
        indexes.sort(Comparator.comparingInt((Integer i) -> -rows.get(i).priority().score()).thenComparing(i -> i));
        return indexes.subList(0, Math.min(TEXT_ITEMS, indexes.size()));
    }

    /** 검색어(AccountAliases.of) 중 하나라도 나오는 설명 후보 문단(현재 보고서). 검색어나 원문이 없으면 빈 목록 */
    public static List<SummaryAiRequest.Source> candidates(List<String> terms, List<DocumentSection> sections,
            List<DocumentBlock> blocks) {
        if (terms.isEmpty()) {
            return List.of();
        }
        Map<Integer, String> paths = paths(sections);
        List<SummaryAiRequest.Source> found = new ArrayList<>();
        for (DocumentBlock block : blocks) {
            String path = paths.getOrDefault(block.sectionNo(), "");
            String compactPath = compact(path);
            if (!DocumentBlock.PARAGRAPH.equals(block.type())
                    || EXPLAINING_SECTIONS.stream().noneMatch(compactPath::contains)) {
                continue;
            }
            String compactText = compact(block.text());
            if (terms.stream().noneMatch(compactText::contains)) {
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
