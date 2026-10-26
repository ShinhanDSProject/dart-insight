package com.dartinsight.disclosure.domain;

import java.util.Map;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 공시 제목으로 핵심 수치 종류(KeyItemKind)를 정하는 규칙표(FS-51, #363). LLM을 쓰지 않는다.
 *
 * <p>제목은 {@link DisclosureGroupRules#title(String)}과 같이 앞머리 꼬리표와 뒤 설명을 떼고 공백을 뺀 값이고, 아래 표와
 * 똑같을 때만 맞는다('자기전환사채만기전취득결정'처럼 낱말이 겹치는 다른 공시와 섞이지 않게 포함이 아니라 같음으로 본다).
 * 제목이 '주요사항보고서('로 시작하지 않는 '유상증자결정'(기타법인 공시)은 OpenDART 주요사항보고서 API에 없어 넣지 않았다
 * (2026-10-26 지티엑스씨 20261021000177로 불러 013).
 *
 * <p>꼬리표는 없거나 [기재정정]일 때만 받는다. [첨부정정]은 OpenDART가 그 접수번호의 행을 따로 주지 않는다
 * (2026-10-26 파이온엑스 20261026000100 실제 호출로 확인). 그 밖의 꼬리표는 확인하지 않아 받지 않는다.
 */
public final class KeyItemRules {

    private static final Pattern LEADING_TAGS = Pattern.compile("^((?:\\s*\\[[^\\]]*\\])*)");
    private static final Pattern SPACES = Pattern.compile("\\s+");
    private static final String CORRECTION_TAG = "[기재정정]";

    /** 정리한 제목 → 종류 */
    public static final Map<String, KeyItemKind> TITLES = Map.of(
            "주요사항보고서(유상증자결정)", KeyItemKind.CAPITAL_INCREASE,
            "주요사항보고서(전환사채권발행결정)", KeyItemKind.CONVERTIBLE_BOND,
            "주요사항보고서(신주인수권부사채권발행결정)", KeyItemKind.BOND_WITH_WARRANT,
            "주요사항보고서(교환사채권발행결정)", KeyItemKind.EXCHANGEABLE_BOND,
            "주요사항보고서(자기주식취득결정)", KeyItemKind.TREASURY_STOCK_ACQUISITION,
            "주요사항보고서(자기주식처분결정)", KeyItemKind.TREASURY_STOCK_DISPOSAL);

    private KeyItemRules() {
    }

    /** 핵심 수치를 받을 수 있는 공시면 그 종류 */
    public static Optional<KeyItemKind> classify(String reportName) {
        String tags = tags(reportName);
        if (!tags.isEmpty() && !CORRECTION_TAG.equals(tags)) {
            return Optional.empty();
        }
        return Optional.ofNullable(TITLES.get(DisclosureGroupRules.title(reportName)));
    }

    /**
     * [기재정정] 공시인지. OpenDART 주요사항보고서 API는 최초 공시의 접수일로 거르고 행에는 마지막 정정본의 접수번호를 주므로,
     * 정정 공시는 그날 하루만 불러서는 찾지 못한다(2026-10-26 모아데이타 20261023000402로 확인).
     */
    public static boolean corrected(String reportName) {
        return CORRECTION_TAG.equals(tags(reportName));
    }

    /** 앞머리 꼬리표를 공백 없이 이어 붙인 값. 없으면 빈 문자열 */
    private static String tags(String reportName) {
        if (reportName == null) {
            return "";
        }
        Matcher matcher = LEADING_TAGS.matcher(reportName.strip());
        return matcher.find() ? SPACES.matcher(matcher.group(1)).replaceAll("") : "";
    }
}
