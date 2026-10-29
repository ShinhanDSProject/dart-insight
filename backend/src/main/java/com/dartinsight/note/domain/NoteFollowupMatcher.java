package com.dartinsight.note.domain;

import com.dartinsight.analysis.domain.CompletedAnalysis;
import com.dartinsight.disclosure.domain.Disclosure;
import com.dartinsight.disclosure.domain.DisclosureGroupRules;
import com.dartinsight.relateddisclosure.domain.RelatedDisclosureRules;
import com.dartinsight.relateddisclosure.domain.RelatedDisclosureRules.Rule;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import java.util.stream.Stream;

/**
 * 판단 노트에 담은 근거 이후의 후속 분석·공시 연결 규칙(6.5, #504).
 * 이미 저장된 분석·보고서·공시 목록과 결정론적 규칙만으로 계산하며, 외부 API나 LLM을 부르지 않는다.
 */
public final class NoteFollowupMatcher {
    public static final int MAX_RELATED_DISCLOSURES = 3;
    public static final int MAX_NEWER_ANALYSES = 3;
    public static final int MAX_NEWER_DISCLOSURES = 5;

    private static final Pattern RCEPT_NO = Pattern.compile("\\d{14}");
    private static final Pattern SPACES = Pattern.compile("\\s+");
    private static final Pattern WORD_SPLIT = Pattern.compile("[^가-힣a-zA-Z0-9]+");
    private static final List<String> EARNINGS_ACCOUNTS = List.of("매출액", "영업이익", "당기순이익");
    private static final Set<String> MEMO_STOPWORDS = Set.of(
            "확인", "예정", "여부", "관련", "비교", "보고서", "공시", "내용", "변화", "증가", "감소");
    private static final Comparator<Disclosure> RECENT_DISCLOSURE = Comparator
            .comparing(Disclosure::rceptDt)
            .thenComparing(Disclosure::rceptNo)
            .reversed();

    private NoteFollowupMatcher() {
    }

    /** 기업 노트 항목들의 근거 보고서 접수번호(14자리 숫자) 가운데 가장 이른 접수번호 */
    public static Optional<String> baselineRceptNo(List<JudgmentNoteItem> items) {
        if (items == null || items.isEmpty()) {
            return Optional.empty();
        }
        return items.stream()
                .map(JudgmentNoteItem::getRceptNo)
                .filter(NoteFollowupMatcher::isRceptNo)
                .min(String::compareTo);
    }

    /**
     * 기준 접수번호 이후의 현재 보고서를 비교한 완료 분석(최대 {@link #MAX_NEWER_ANALYSES}건).
     * 이미 노트 항목들이 가리키는 분석 ID는 제외한다.
     */
    public static List<CompletedAnalysis> newerAnalyses(List<JudgmentNoteItem> items,
            List<CompletedAnalysis> completedAnalyses) {
        Optional<String> baseline = baselineRceptNo(items);
        if (baseline.isEmpty() || completedAnalyses == null || completedAnalyses.isEmpty()) {
            return List.of();
        }
        String baselineRceptNo = baseline.get();
        Set<Long> notedAnalysisIds = items.stream()
                .map(JudgmentNoteItem::getAnalysisId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
        return completedAnalyses.stream()
                .filter(c -> c.analysis().isCompleted())
                .filter(c -> isAfter(c.analysis().getCurrentRceptNo(), baselineRceptNo))
                .filter(c -> c.analysis().getId() == null || !notedAnalysisIds.contains(c.analysis().getId()))
                .limit(MAX_NEWER_ANALYSES)
                .toList();
    }

    /** 기준 접수번호 이후에 접수된 철회 아닌 공시(접수일 최근 순, 같으면 접수번호 큰 순, 최대 {@link #MAX_NEWER_DISCLOSURES}건) */
    public static List<Disclosure> newerDisclosures(List<JudgmentNoteItem> items, List<Disclosure> disclosures) {
        Optional<String> baseline = baselineRceptNo(items);
        if (baseline.isEmpty() || disclosures == null || disclosures.isEmpty()) {
            return List.of();
        }
        return disclosuresAfter(disclosures, baseline.get())
                .limit(MAX_NEWER_DISCLOSURES)
                .toList();
    }

    /**
     * 노트 항목 하나의 근거 보고서 이후 공시 가운데 항목 주제({@link RelatedDisclosureRules})나 메모 핵심어와 맞닿는 공시
     * (접수일 최근 순, 같으면 접수번호 큰 순, 최대 {@link #MAX_RELATED_DISCLOSURES}건).
     */
    public static List<MatchedDisclosure> relatedDisclosures(JudgmentNoteItem item, List<Disclosure> disclosures) {
        if (item == null || !isRceptNo(item.getRceptNo()) || disclosures == null || disclosures.isEmpty()) {
            return List.of();
        }
        List<Rule> rules = itemRules(item.getKind(), item.getSnapshotLabel(), item.getSnapshotText(), item.getMemo());
        List<String> keywords = memoKeywords(item.getMemo());
        if (rules.isEmpty() && keywords.isEmpty()) {
            return List.of();
        }
        return disclosuresAfter(disclosures, item.getRceptNo())
                .flatMap(d -> matchLabel(rules, keywords, d.reportName())
                        .map(label -> new MatchedDisclosure(d, label))
                        .stream())
                .limit(MAX_RELATED_DISCLOSURES)
                .toList();
    }

    static List<Rule> itemRules(NoteKind kind, String label, String text, String memo) {
        List<String> sectionPaths = label == null ? List.of() : List.of(label);
        List<Rule> rules = new ArrayList<>(RelatedDisclosureRules.changeRules(sectionPaths, combineText(text, memo)));
        if (kind == NoteKind.FINANCIAL_CHANGE && hasEarningsAccount(label)) {
            RelatedDisclosureRules.RULES.stream()
                    .filter(rule -> "earnings".equals(rule.key()))
                    .filter(rule -> !rules.contains(rule))
                    .forEach(rules::add);
        }
        return List.copyOf(rules);
    }

    static List<String> memoKeywords(String memo) {
        if (memo == null || memo.isBlank()) {
            return List.of();
        }
        return Arrays.stream(WORD_SPLIT.split(memo.strip()))
                .filter(word -> word.length() >= 2)
                .filter(word -> !MEMO_STOPWORDS.contains(word))
                .distinct()
                .toList();
    }

    static Optional<String> matchLabel(List<Rule> itemRules, List<String> memoKeywords, String reportName) {
        Optional<Rule> rule = RelatedDisclosureRules.firstCommon(itemRules,
                RelatedDisclosureRules.titleRules(reportName));
        if (rule.isPresent()) {
            return Optional.of(rule.get().label());
        }
        if (memoKeywords.isEmpty()) {
            return Optional.empty();
        }
        String title = DisclosureGroupRules.title(reportName).toLowerCase(Locale.ROOT);
        if (title.isEmpty()) {
            return Optional.empty();
        }
        return memoKeywords.stream()
                .filter(word -> title.contains(word.toLowerCase(Locale.ROOT)))
                .findFirst()
                .map(word -> "메모 '" + word + "'");
    }

    private static Stream<Disclosure> disclosuresAfter(List<Disclosure> disclosures, String baselineRceptNo) {
        return disclosures.stream()
                .filter(d -> isAfter(d.rceptNo(), baselineRceptNo))
                .filter(d -> !RelatedDisclosureRules.isWithdrawn(d.remark()))
                .sorted(RECENT_DISCLOSURE);
    }

    private static String combineText(String text, String memo) {
        String base = text == null ? "" : text;
        if (memo == null || memo.isBlank()) {
            return base;
        }
        return base.isEmpty() ? memo : base + "\n" + memo;
    }

    private static boolean hasEarningsAccount(String label) {
        if (label == null) {
            return false;
        }
        String compact = SPACES.matcher(label).replaceAll("");
        return EARNINGS_ACCOUNTS.stream().anyMatch(compact::contains);
    }

    private static boolean isRceptNo(String rceptNo) {
        return rceptNo != null && RCEPT_NO.matcher(rceptNo).matches();
    }

    private static boolean isAfter(String rceptNo, String baselineRceptNo) {
        return isRceptNo(rceptNo) && rceptNo.compareTo(baselineRceptNo) > 0;
    }

    public record MatchedDisclosure(Disclosure disclosure, String matchLabel) {
    }
}
