package com.dartinsight.disclosure.domain;

/**
 * 확인해 볼 공시 종류(docs/api-spec.md 공통 값 disclosureSignalKind, FS-55). 선언 순서가 응답·화면의 순서다.
 * 어떤 공시가 어느 종류인지는 {@link DisclosureSignalRules}가 정한다. 이름과 문장에 평가하는 말을 넣지 않는다.
 */
public enum DisclosureSignalKind {
    LARGEST_SHAREHOLDER_CHANGE("최대주주 변경", Source.DISCLOSURE_LIST, "최대주주가 바뀌었다고 공시했어요."),
    CAPITAL_INCREASE("유상증자 결정", Source.DISCLOSURE_LIST, "유상증자를 결정했다고 공시했어요."),
    CONVERTIBLE_BOND("전환사채 발행 결정", Source.DISCLOSURE_LIST, "전환사채 발행을 결정했다고 공시했어요."),
    BOND_WITH_WARRANT("신주인수권부사채 발행 결정", Source.DISCLOSURE_LIST, "신주인수권부사채 발행을 결정했다고 공시했어요."),
    LITIGATION("소송 등 제기", Source.DISCLOSURE_LIST, "소송 등이 제기됐다고 공시했어요."),
    REHABILITATION_LISTING("회생·상장 관련 공시", Source.DISCLOSURE_LIST, "회생 절차나 상장 유지와 관련된 공시가 나왔어요."),
    /** 문장은 감사인 이름이 들어가 {@link DisclosureSignalRules#auditorChangeSentence}가 만든다 */
    AUDITOR_CHANGE("감사인 변경", Source.AUDIT_OPINION, null),
    /** 문장은 감사의견 원문이 들어가 {@link DisclosureSignalRules#auditOpinionSentence}가 만든다 */
    NON_CLEAN_AUDIT_OPINION("감사의견(적정이 아님)", Source.AUDIT_OPINION, null);

    /** 종류를 정하는 자료. 자료 하나를 받지 못하면 그 자료의 종류만 확인하지 못함이다 */
    public enum Source {
        /** 최근 공시 목록(공시검색 list.json)의 제목 */
        DISCLOSURE_LIST,
        /** 사업보고서의 회계감사인의 명칭 및 감사의견(accnutAdtorNmNdAdtOpinion.json) */
        AUDIT_OPINION
    }

    private final String label;
    private final Source source;
    private final String sentence;

    DisclosureSignalKind(String label, Source source, String sentence) {
        this.label = label;
        this.source = source;
        this.sentence = sentence;
    }

    public String label() {
        return label;
    }

    public Source source() {
        return source;
    }

    /** 공시 제목으로 정하는 종류의 사실 문장. 감사 두 종류는 null */
    public String sentence() {
        return sentence;
    }
}
