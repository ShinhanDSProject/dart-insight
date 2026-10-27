package com.dartinsight.relateddisclosure.domain;

import com.dartinsight.disclosure.domain.DisclosureKeyItems;
import com.dartinsight.disclosure.domain.KeyItem;
import com.dartinsight.disclosure.domain.KeyItemKind;
import com.dartinsight.disclosure.domain.KeyItemStatus;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 관련 수시공시 2단계 '내용 일치'(STRONG) 판정(3.6, ADR-0030). 주요사항보고서 주요정보(DS005) 값이 변경 글에 있는지 본다.
 * LLM을 쓰지 않고, 금액은 단위가 달라(DS005 원, 본문 천원·백만원) v1에서 대조하지 않는다.
 *
 * <ul>
 *   <li>유상증자({@link KeyItemKind#CAPITAL_INCREASE}): 신주 수(보통·기타). 쉼표를 뺀 4자리 이상 숫자가 글에 같은 숫자로
 *       있으면(앞뒤에 다른 숫자가 붙지 않음) {@link #NEW_SHARES}</li>
 *   <li>소송({@link KeyItemKind#LITIGATION}): 원고·신청인(쉼표 등으로 나눈 이름마다, 회사 자신은 뺌)이 글에 있으면
 *       {@link #PLAINTIFF}, 사건의 명칭이 공백을 뺀 글에 있으면 {@link #CASE_NAME}</li>
 *   <li>양수({@link KeyItemKind#STOCK_ACQUISITION}): 발행회사 이름이 글에 있으면 {@link #TARGET_COMPANY}. 발행회사 이름에
 *       '(구: …)'가 있으면 옛 사명도 본다. 글 쪽 '㈜새 사명(구: 옛 사명)'은 옛 사명이 글 안에 그대로 있어 걸린다</li>
 * </ul>
 * 이름은 '주식회사'·'(주)'·'㈜'와 공백을 빼고 영문은 소문자로 바꿔 부분 일치로 본다. 2글자보다 짧은 이름은 대조하지 않는다.
 */
public final class KeyItemMatcher {

    public static final String NEW_SHARES = "NEW_SHARES";
    public static final String PLAINTIFF = "PLAINTIFF";
    public static final String CASE_NAME = "CASE_NAME";
    public static final String TARGET_COMPANY = "TARGET_COMPANY";

    /** 2단계 판정을 하는 종류. 이 종류의 B001 공시만 주요정보를 받는다 */
    public static final Set<KeyItemKind> KINDS = Set.of(KeyItemKind.CAPITAL_INCREASE, KeyItemKind.LITIGATION,
            KeyItemKind.STOCK_ACQUISITION);

    private static final List<String> NEW_SHARE_FIELDS = List.of("nstk_ostk_cnt", "nstk_estk_cnt");
    private static final Pattern DIGIT_COMMA = Pattern.compile("(?<=\\d),(?=\\d{3})");
    private static final Pattern NOT_DIGIT = Pattern.compile("\\D");
    private static final Pattern SPACES = Pattern.compile("\\s+");
    private static final Pattern COMPANY_MARKS = Pattern.compile("주식회사|\\(주\\)|（주）|㈜");
    private static final Pattern NAME_SEPARATORS = Pattern.compile("[,，、/\\n]");
    private static final Pattern OTHERS_SUFFIX = Pattern.compile("외\\s*\\d+\\s*(?:인|명|사|개사)?$");
    /** '(구: 옛 사명)'·'(구 옛 사명)'. '(구로지점)'처럼 '구' 뒤에 콜론·공백이 없으면 옛 사명으로 보지 않는다 */
    private static final Pattern FORMER_NAME = Pattern.compile("\\(\\s*구\\s*[:：\\s]\\s*([^)]+)\\)");
    private static final int MIN_NAME = 2;
    private static final int MIN_SHARES_DIGITS = 4;

    private KeyItemMatcher() {
    }

    /**
     * 일치한 값 종류(위 상수, 정한 순서). 자료가 없거나(NO_DATA) 대조하지 않는 종류면 빈 목록.
     *
     * @param text        대조할 변경 글. null이면 빈 목록
     * @param companyName 공시 대상 회사 이름(원고에서 뺄 회사 자신)
     */
    public static List<String> matchedFields(DisclosureKeyItems keyItems, String text, String companyName) {
        List<String> fields = new ArrayList<>();
        if (keyItems == null || keyItems.status() != KeyItemStatus.AVAILABLE || text == null || text.isBlank()) {
            return fields;
        }
        switch (keyItems.kind()) {
            case CAPITAL_INCREASE -> {
                if (hasNewShares(keyItems, text)) {
                    fields.add(NEW_SHARES);
                }
            }
            case LITIGATION -> {
                if (hasPlaintiff(keyItems, text, companyName)) {
                    fields.add(PLAINTIFF);
                }
                if (hasCaseName(keyItems, text)) {
                    fields.add(CASE_NAME);
                }
            }
            case STOCK_ACQUISITION -> {
                if (hasTargetCompany(keyItems, text)) {
                    fields.add(TARGET_COMPANY);
                }
            }
            default -> {
                // 다른 종류는 대조하지 않는다
            }
        }
        return fields;
    }

    private static boolean hasNewShares(DisclosureKeyItems keyItems, String text) {
        String plain = DIGIT_COMMA.matcher(text).replaceAll("");
        for (String field : NEW_SHARE_FIELDS) {
            Optional<String> value = value(keyItems, field);
            if (value.isEmpty()) {
                continue;
            }
            String digits = NOT_DIGIT.matcher(value.get()).replaceAll("");
            if (digits.length() >= MIN_SHARES_DIGITS
                    && Pattern.compile("(?<!\\d)" + digits + "(?!\\d)").matcher(plain).find()) {
                return true;
            }
        }
        return false;
    }

    private static boolean hasPlaintiff(DisclosureKeyItems keyItems, String text, String companyName) {
        Optional<String> plaintiffs = value(keyItems, "ac_ap");
        if (plaintiffs.isEmpty()) {
            return false;
        }
        String self = companyName == null ? "" : name(companyName);
        String target = name(text);
        for (String part : NAME_SEPARATORS.split(plaintiffs.get())) {
            String plaintiff = name(OTHERS_SUFFIX.matcher(part.strip()).replaceFirst(""));
            if (plaintiff.length() >= MIN_NAME && !plaintiff.equals(self) && target.contains(plaintiff)) {
                return true;
            }
        }
        return false;
    }

    private static boolean hasCaseName(DisclosureKeyItems keyItems, String text) {
        return value(keyItems, "icnm")
                .map(KeyItemMatcher::compact)
                .filter(caseName -> caseName.length() >= MIN_NAME)
                .map(caseName -> compact(text).contains(caseName))
                .orElse(false);
    }

    private static boolean hasTargetCompany(DisclosureKeyItems keyItems, String text) {
        Optional<String> value = value(keyItems, "iscmp_cmpnm");
        if (value.isEmpty()) {
            return false;
        }
        // '(주)'의 닫는 괄호에서 옛 사명이 끊기지 않게 회사 표시를 먼저 뺀다
        String company = COMPANY_MARKS.matcher(value.get()).replaceAll("");
        List<String> names = new ArrayList<>();
        Matcher former = FORMER_NAME.matcher(company);
        while (former.find()) {
            names.add(former.group(1));
        }
        names.add(FORMER_NAME.matcher(company).replaceAll(""));
        String target = name(text);
        for (String candidate : names) {
            String normalized = name(candidate);
            if (normalized.length() >= MIN_NAME && target.contains(normalized)) {
                return true;
            }
        }
        return false;
    }

    private static Optional<String> value(DisclosureKeyItems keyItems, String field) {
        return keyItems.items().stream()
                .filter(item -> field.equals(item.field()))
                .map(KeyItem::value)
                .filter(v -> v != null && !v.isBlank())
                .findFirst();
    }

    /** 회사 표시('주식회사'·'(주)'·'㈜')와 공백을 빼고 영문을 소문자로 바꾼 이름 */
    private static String name(String value) {
        return compact(COMPANY_MARKS.matcher(value).replaceAll("")).toLowerCase(Locale.ROOT);
    }

    private static String compact(String value) {
        return SPACES.matcher(value).replaceAll("");
    }
}
