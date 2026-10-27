package com.dartinsight.relateddisclosure.domain;

import com.dartinsight.analysis.domain.TextChange;
import com.dartinsight.analysis.domain.TextChangeRow;
import com.dartinsight.disclosure.domain.DisclosureGroupRules;
import com.dartinsight.disclosure.domain.DisclosureKeyItems;
import com.dartinsight.relateddisclosure.domain.RelatedDisclosureRules.Rule;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/**
 * 문장 변경과 기간 공시를 1단계 제목 규칙으로 연결한다(3.6, ADR-0030). 같은 입력이면 늘 같은 결과다.
 *
 * <ul>
 *   <li>대조할 글: 현재 글이 있으면 현재 글, 없으면 이전 글(ADDED·MODIFIED·NUMERIC_UPDATE·MOVED는 현재 쪽, DELETED는
 *       이전 쪽). REVIEW_NEEDED도 있는 쪽 글로 본다. 섹션 경로는 변경의 섹션 경로이고, MOVED는 이전 섹션 경로도 본다</li>
 *   <li>공시: 비고에 '철'이 있으면 뺀다. 정정본([기재정정] 등)은 하나마다 정리한 제목이 같고 접수번호가 앞선 비고 '정'
 *       공시 하나를 고쳐 쓴 것으로 보고 그 공시를 뺀다(정정본만 연결). 목록에는 어느 공시를 고쳤는지 없으므로 짝이 아직 없는
 *       것 중 바로 앞(접수번호가 가장 뒤)의 것을 고른다. 정정본 하나가 같은 제목의 원본을 모두 지우면 서로 다른 사건
 *       (예: 여러 공급계약)이 빠지기 때문이다. 짝이 없는 '정' 공시(정정본이 기간 뒤)는 남긴다</li>
 *   <li>시점: 접수일 ≤ 현재 보고서 기간 말일이면 DURING, 아니면 AFTER</li>
 * </ul>
 */
public final class RelatedDisclosureMatcher {

    private static final Comparator<WindowDisclosure> BY_DATE =
            Comparator.comparing(WindowDisclosure::rceptDt).thenComparing(WindowDisclosure::rceptNo);

    private RelatedDisclosureMatcher() {
    }

    /**
     * @param changes     분석의 문장 변경(변경 순서)
     * @param disclosures 기간 공시 목록(저장된 것)
     * @param periodEnd   현재 보고서 기간 말일
     * @return 변경 순서, 같은 변경 안에서는 접수일·접수번호 순서의 연결(1단계라 모두 TYPE_ONLY)
     */
    public static List<RelatedLink> match(List<TextChange> changes, List<WindowDisclosure> disclosures,
            LocalDate periodEnd) {
        List<Candidate> candidates = candidates(disclosures);
        List<RelatedLink> links = new ArrayList<>();
        if (candidates.isEmpty()) {
            return links;
        }
        for (TextChange change : changes) {
            List<Rule> changeRules = changeRules(change.row());
            if (changeRules.isEmpty()) {
                continue;
            }
            for (Candidate candidate : candidates) {
                Optional<Rule> rule = RelatedDisclosureRules.firstCommon(changeRules, candidate.rules());
                if (rule.isPresent()) {
                    WindowDisclosure d = candidate.disclosure();
                    links.add(new RelatedLink(change.changeNo(), d, null, timing(d.rceptDt(), periodEnd),
                            rule.get().key(), MatchLevel.TYPE_ONLY, null));
                }
            }
        }
        return links;
    }

    /**
     * 2단계: 주요정보(DS005)를 받은 공시의 연결을 '내용 일치'(STRONG)로 올리고, 최신 정정본 접수번호를 알면 채운다
     * ({@link KeyItemMatcher}). 주요정보가 없는 공시의 연결은 그대로 둔다. 순서는 바꾸지 않는다.
     *
     * @param keyItems    접수번호 → 받은 주요정보(자료 없음 포함)
     * @param companyName 공시 대상 회사 이름(소송 원고에서 뺄 회사 자신)
     */
    public static List<RelatedLink> strengthen(List<RelatedLink> links, List<TextChange> changes,
            Map<String, DisclosureKeyItems> keyItems, String companyName) {
        if (keyItems.isEmpty()) {
            return links;
        }
        Map<Integer, String> texts = new HashMap<>();
        for (TextChange change : changes) {
            texts.put(change.changeNo(), targetText(change.row()));
        }
        List<RelatedLink> result = new ArrayList<>(links.size());
        for (RelatedLink link : links) {
            DisclosureKeyItems items = keyItems.get(link.disclosure().rceptNo());
            if (items == null) {
                result.add(link);
                continue;
            }
            List<String> fields = KeyItemMatcher.matchedFields(items, texts.get(link.changeNo()), companyName);
            result.add(new RelatedLink(link.changeNo(), link.disclosure(), items.sourceRceptNo(), link.timing(),
                    link.matchRule(), fields.isEmpty() ? MatchLevel.TYPE_ONLY : MatchLevel.STRONG,
                    fields.isEmpty() ? null : String.join(",", fields)));
        }
        return result;
    }

    /** 변경이 걸리는 규칙. 대조할 글과 섹션 경로는 클래스 설명과 같다 */
    static List<Rule> changeRules(TextChangeRow row) {
        List<String> paths = new ArrayList<>();
        paths.add(row.sectionPath());
        if (TextChangeRow.MOVED.equals(row.changeType())) {
            paths.add(row.previousSectionPath());
        }
        return RelatedDisclosureRules.changeRules(paths, targetText(row));
    }

    /** 대조할 글: 현재 글이 있으면 현재 글, 없으면 이전 글. 둘 다 없으면 null */
    static String targetText(TextChangeRow row) {
        TextChangeRow.Side side = row.current() != null ? row.current() : row.previous();
        return side == null ? null : side.text();
    }

    static DisclosureTiming timing(LocalDate rceptDt, LocalDate periodEnd) {
        return rceptDt.isAfter(periodEnd) ? DisclosureTiming.AFTER : DisclosureTiming.DURING;
    }

    /** 연결할 수 있는 공시와 그 제목이 걸리는 규칙. 철회·기간 안에 정정본이 있는 원본은 뺀다. 접수일 순서 */
    static List<Candidate> candidates(List<WindowDisclosure> disclosures) {
        List<WindowDisclosure> sorted = new ArrayList<>(disclosures);
        sorted.sort(BY_DATE);
        Set<String> replaced = replacedByCorrection(sorted);
        List<Candidate> candidates = new ArrayList<>();
        for (WindowDisclosure d : sorted) {
            if (RelatedDisclosureRules.isWithdrawn(d.remark()) || replaced.contains(d.rceptNo())) {
                continue;
            }
            List<Rule> rules = RelatedDisclosureRules.titleRules(d.reportName());
            if (!rules.isEmpty()) {
                candidates.add(new Candidate(d, rules));
            }
        }
        return candidates;
    }

    /** 기간 안의 정정본이 고쳐 쓴 공시의 접수번호. 정정본 하나에 공시 하나다(클래스 설명) */
    private static Set<String> replacedByCorrection(List<WindowDisclosure> all) {
        List<WindowDisclosure> byRceptNo = new ArrayList<>(all);
        byRceptNo.sort(Comparator.comparing(WindowDisclosure::rceptNo));
        Set<String> replaced = new HashSet<>();
        for (int i = 0; i < byRceptNo.size(); i++) {
            WindowDisclosure correction = byRceptNo.get(i);
            if (!RelatedDisclosureRules.isCorrection(correction.reportName())) {
                continue;
            }
            String title = DisclosureGroupRules.title(correction.reportName());
            for (int j = i - 1; j >= 0; j--) {
                WindowDisclosure earlier = byRceptNo.get(j);
                if (RelatedDisclosureRules.isCorrected(earlier.remark()) && !replaced.contains(earlier.rceptNo())
                        && title.equals(DisclosureGroupRules.title(earlier.reportName()))) {
                    replaced.add(earlier.rceptNo());
                    break;
                }
            }
        }
        return replaced;
    }

    record Candidate(WindowDisclosure disclosure, List<Rule> rules) {
    }
}
