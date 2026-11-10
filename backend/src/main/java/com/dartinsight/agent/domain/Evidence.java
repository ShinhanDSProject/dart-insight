package com.dartinsight.agent.domain;

import java.util.List;
import java.util.Locale;

/**
 * Tool을 실행하며 backend가 저장된 자료로 만든 근거 위치 하나. 채팅 한 번 안에서 근거 ID → 위치 표로 들고 있다가,
 * 최종 답의 근거 ID가 이 표에 있는지 확인하고(ADR-0044) 응답의 citations를 만든다.
 *
 * @param side       previous, current. 근거 종류에 따라 null
 * @param reportName 수시공시 제목. 정기보고서 근거면 null(응답에서 보고서 이름을 붙임)
 * @param rceptDt    수시공시 접수일(YYYY-MM-DD). 그 밖은 null
 * @param dartUrl    수시공시 원문 링크. 그 밖은 null
 * @param quote      글 앞부분(화면 미리보기)
 * @param sentence   재무 계정 변화의 사실 문장(코드가 저장된 계산 결과로 만듦)
 * @param grade      저장된 재무 설명 등급(STATED·RELATED·NONE, ADR-0015). 저장된 요약에서 온 근거만 있다
 * @param value      보고서 값(REPORT_VALUE)·기업(COMPANY) 근거의 값. 그 밖은 null
 * @param term       용어 카드(GLOSSARY) 근거의 카드. 그 밖은 null
 */
public record Evidence(String evidenceId, Kind kind, String side, String rceptNo, String reportName, String rceptDt,
        String dartUrl, Integer sectionNo, Integer blockNo, String sectionPath, String quote, Long changeId,
        String changeType, String sjDiv, String accountName, String sentence, String grade, Value value, Term term) {

    /** 화면 미리보기 길이(근거 질문의 quote와 같음) */
    public static final int QUOTE_CHARS = 160;
    /** 검색어로 인용을 고를 때 검색어 앞에 남기는 글자 수(#850) */
    static final int QUOTE_LEAD = 40;
    /** 문단 앞부분 인용에 검색어가 있어도 뒤에 이만큼 이어지지 않으면 검색어 쪽으로 옮긴다(#850) */
    static final int QUOTE_TAIL = 60;
    /** 문단 중간을 인용할 때 잘린 쪽에 붙이는 표시 */
    static final String CUT = "…";
    /** 용어 카드 근거 ID의 앞 글자(G{카드 키}, ADR-0061) */
    public static final String GLOSSARY_PREFIX = "G";

    public enum Kind {
        BLOCK, SECTION, TEXT_CHANGE, FINANCIAL_CHANGE, DISCLOSURE, REPORT_VALUE, GLOSSARY, COMPANY
    }

    /** 보고서 값({접수번호}#V{n})의 번호를 채팅 안에서 붙이기 전 자리 표시 */
    static final String VALUE_MARK = "#V";

    /**
     * 보고서 값·기업 근거의 값. 기존 API가 준 값 그대로 둔다(docs/api-spec.md 채팅 API citations).
     *
     * @param source   보고서 값의 출처(FINANCIAL_TREND·KEY_FACT·CHECKPOINT·DISCLOSURE_KEY_ITEM). 기업 근거면 null
     * @param label    항목 이름
     * @param value    값(그 API가 준 값 그대로. 숫자 또는 글). 없으면 null
     * @param unit     단위. 없으면 null
     * @param currency 금액의 통화. 금액이 아니면 null
     * @param corpCode 기업 근거만
     * @param corpName 기업 근거만
     */
    public record Value(String source, String label, Object value, String unit, String currency, String corpCode,
            String corpName) {
    }

    /**
     * 용어 카드 근거(ADR-0061). 출처·검토를 마친 카드만 근거가 된다.
     *
     * @param key        카드 키
     * @param term       용어
     * @param definition 한 줄 뜻
     * @param sources    카드 출처
     */
    public record Term(String key, String term, String definition, List<Source> sources) {

        public Term {
            sources = sources == null ? List.of() : List.copyOf(sources);
        }
    }

    /** 카드 출처 */
    public record Source(String title, String url) {
    }

    /** 원문 문단·표. 근거 ID는 저장된 원문 위치({접수번호}#B{블록 번호}) */
    public static Evidence block(String evidenceId, String side, String rceptNo, int sectionNo, int blockNo,
            String sectionPath, String text) {
        return new Evidence(evidenceId, Kind.BLOCK, side, rceptNo, null, null, null, sectionNo, blockNo, sectionPath,
                quote(text), null, null, null, null, null, null, null, null);
    }

    /** 원문 목차 항목 */
    public static Evidence section(String side, String rceptNo, int sectionNo, String sectionPath) {
        return new Evidence(sectionId(rceptNo, sectionNo), Kind.SECTION, side, rceptNo, null, null, null, sectionNo,
                null, sectionPath, null, null, null, null, null, null, null, null, null);
    }

    /** 문장 변경. rceptNo는 현재 쪽(삭제면 이전 쪽) */
    public static Evidence textChange(long changeId, String changeType, String rceptNo, String sectionPath,
            String text) {
        return textChange(changeId, changeType, rceptNo, sectionPath, text, null);
    }

    /** 검색어(search_text_changes의 q)로 찾은 문장 변경. 인용에 검색어가 보이게 고른다(#850) */
    public static Evidence textChange(long changeId, String changeType, String rceptNo, String sectionPath,
            String text, String focus) {
        return new Evidence(textChangeId(changeId), Kind.TEXT_CHANGE, null, rceptNo, null, null, null, null, null,
                sectionPath, quote(text, focus), changeId, changeType, null, null, null, null, null, null);
    }

    /** 재무 계정 변화. rceptNo는 현재 보고서 */
    public static Evidence financialChange(long changeId, String sjDiv, String accountName, String rceptNo,
            String sentence) {
        return new Evidence(financialChangeId(changeId), Kind.FINANCIAL_CHANGE, null, rceptNo, null, null, null, null,
                null, null, null, changeId, null, sjDiv, accountName, sentence, null, null, null);
    }

    /** 수시공시(보조 근거). 근거 ID는 D{접수번호} */
    public static Evidence disclosure(String rceptNo, String reportName, String rceptDt, String dartUrl) {
        return new Evidence("D" + rceptNo, Kind.DISCLOSURE, null, rceptNo, reportName, rceptDt, dartUrl, null, null,
                null, null, null, null, null, null, null, null, null, null);
    }

    /**
     * 기존 기업 화면 API가 준 보고서 값 하나. 근거 ID 번호({접수번호}#V{n})는 채팅 안에서 붙이므로 여기서는 자리만 둔다.
     *
     * @param rceptNo 값의 근거 접수번호(그 API에 sourceRceptNo가 있으면 그것)
     */
    public static Evidence reportValue(String rceptNo, String reportName, String dartUrl, String source, String label,
            Object value, String unit, String currency) {
        return new Evidence(rceptNo + VALUE_MARK, Kind.REPORT_VALUE, null, rceptNo, reportName, null, dartUrl, null,
                null, null, null, null, null, null, null, null, null,
                new Value(source, label, value, unit, currency, null, null), null);
    }

    /** 용어 카드 하나. 근거 ID는 G{카드 키} */
    public static Evidence glossary(Term term) {
        return new Evidence(glossaryId(term.key()), Kind.GLOSSARY, null, null, null, null, null, null, null, null, null,
                null, null, null, null, null, null, null, term);
    }

    /** 기업 하나(개황 항목 또는 기업 검색 결과). 근거 ID는 C{고유번호} */
    public static Evidence company(String corpCode, String corpName, String label, Object value) {
        return new Evidence("C" + corpCode, Kind.COMPANY, null, null, null, null, null, null, null, null, null, null,
                null, null, null, null, null, new Value(null, label, value, null, null, corpCode, corpName), null);
    }

    /** 번호를 붙이기 전의 보고서 값 근거인지 */
    public boolean unnumberedValue() {
        return kind == Kind.REPORT_VALUE && evidenceId.endsWith(VALUE_MARK);
    }

    /** 번호를 붙인 보고서 값 근거({접수번호}#V{n}) */
    public Evidence withValueNo(int no) {
        return withId(evidenceId + no);
    }

    /** 같은 보고서 값인지 가리는 키(접수번호·출처·항목·값). 같은 값을 다시 조회하면 같은 번호를 쓴다 */
    public String valueKey() {
        return rceptNo + "|" + value.source() + "|" + value.label() + "|" + value.value();
    }

    /** 근거 ID만 바꾼 근거 */
    private Evidence withId(String id) {
        return new Evidence(id, kind, side, rceptNo, reportName, rceptDt, dartUrl, sectionNo, blockNo, sectionPath,
                quote, changeId, changeType, sjDiv, accountName, sentence, grade, value, term);
    }

    /** 저장된 요약의 설명 등급을 붙인 근거 */
    public Evidence withGrade(String level) {
        return new Evidence(evidenceId, kind, side, rceptNo, reportName, rceptDt, dartUrl, sectionNo, blockNo,
                sectionPath, quote, changeId, changeType, sjDiv, accountName, sentence, level, value, term);
    }

    /** 비어 있는 값만 같은 근거의 다른 값으로 채운다(요약 Tool은 위치 없이, 조회 Tool은 등급 없이 줌) */
    public Evidence fill(Evidence other) {
        return new Evidence(evidenceId, kind, or(side, other.side), or(rceptNo, other.rceptNo),
                or(reportName, other.reportName), or(rceptDt, other.rceptDt), or(dartUrl, other.dartUrl),
                or(sectionNo, other.sectionNo), or(blockNo, other.blockNo), or(sectionPath, other.sectionPath),
                or(quote, other.quote), or(changeId, other.changeId), or(changeType, other.changeType),
                or(sjDiv, other.sjDiv), or(accountName, other.accountName), or(sentence, other.sentence),
                or(grade, other.grade), or(value, other.value), or(term, other.term));
    }

    private static <T> T or(T value, T fallback) {
        return value != null ? value : fallback;
    }

    public static String textChangeId(long changeId) {
        return "T" + changeId;
    }

    public static String financialChangeId(long changeId) {
        return "F" + changeId;
    }

    public static String sectionId(String rceptNo, int sectionNo) {
        return rceptNo + "#S" + sectionNo;
    }

    public static String glossaryId(String key) {
        return GLOSSARY_PREFIX + key;
    }

    private static String quote(String text) {
        return quote(text, null);
    }

    /**
     * 화면 미리보기 인용. 보통은 문단 앞 {@link #QUOTE_CHARS}자다. 검색어가 앞부분에 없거나 뒤가
     * {@link #QUOTE_TAIL}자 안 되게 끝에 걸리면, 검색어 {@link #QUOTE_LEAD}자 앞부터 자르고 잘린 앞·뒤에
     * {@link #CUT}을 붙인다(#850). 검색어는 대소문자를 가리지 않는다(문장 변경 검색과 같음).
     */
    static String quote(String text, String focus) {
        if (text == null) {
            return null;
        }
        if (text.length() <= QUOTE_CHARS) {
            return text;
        }
        int at = focus == null || focus.isBlank() ? -1
                : text.toLowerCase(Locale.ROOT).indexOf(focus.toLowerCase(Locale.ROOT));
        if (at < 0 || at + focus.length() + QUOTE_TAIL <= QUOTE_CHARS) {
            return text.substring(0, QUOTE_CHARS);
        }
        int end = Math.min(text.length(), at - QUOTE_LEAD + QUOTE_CHARS);
        int start = Math.max(0, end - QUOTE_CHARS);
        return (start > 0 ? CUT : "") + text.substring(start, end) + (end < text.length() ? CUT : "");
    }
}
