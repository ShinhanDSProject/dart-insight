package com.dartinsight.checkpoint.domain;

/**
 * 재무 체크 포인트 항목(FS-62, docs/api-spec.md). 선언 순서가 응답·화면의 순서다. 기준값 문구는 {@link CheckpointRules}의
 * 상수와 같다. {@code why}는 투자자가 이 항목을 왜 보는지의 일반 설명이고 회사를 평가하지 않는다.
 */
public enum CheckpointKey {

    EARNINGS_QUALITY("이익과 현금흐름",
            "영업이익은 회계상 이익이고, 영업활동현금흐름은 영업으로 실제 들어오고 나간 현금이에요. 두 값의 방향이 다르면 "
                    + "이익이 현금으로 이어졌는지 현금흐름표와 주석을 함께 살펴보는 경우가 많아요.",
            "올해 영업이익과 영업활동현금흐름의 부호, 그리고 두 값의 작년 대비 방향",
            "영업이익이 0보다 크고 영업활동현금흐름이 0보다 작거나, 영업이익은 늘었는데 영업활동현금흐름이 줄었으면 확인해 볼 점"),
    RECEIVABLES("매출채권",
            "매출채권은 물건이나 서비스를 팔고 아직 받지 못한 돈이에요. 매출보다 빨리 늘면 대금을 받는 조건이나 거래처가 "
                    + "바뀌었는지 주석에서 함께 살펴보는 경우가 많아요.",
            "증가율 = (올해 − 작년) ÷ 작년 × 100, 차이 = 매출채권 증가율 − 매출 증가율",
            "매출채권 증가율 − 매출 증가율이 " + CheckpointRules.RECEIVABLES_GAP + "%p 이상이면 확인해 볼 점"),
    INVENTORIES("재고자산",
            "재고자산은 팔려고 가지고 있는 제품·원재료예요. 매출보다 빨리 늘면 생산·판매 계획이나 재고 평가 내용을 "
                    + "사업의 내용과 주석에서 함께 살펴보는 경우가 많아요.",
            "증가율 = (올해 − 작년) ÷ 작년 × 100, 차이 = 재고자산 증가율 − 매출 증가율",
            "재고자산 증가율 − 매출 증가율이 " + CheckpointRules.INVENTORIES_GAP + "%p 이상이면 확인해 볼 점"),
    DEBT_RATIO("부채비율",
            "부채비율은 자본에 견준 부채의 크기예요. 한 해 사이 크게 바뀌면 차입·사채 발행이나 자본 변동이 있었는지 "
                    + "살펴보는 경우가 많아요. 보통 수준은 업종마다 달라요.",
            "부채비율 = 부채총계 ÷ 자본총계 × 100, 변화 = 올해 부채비율 − 작년 부채비율",
            "부채비율이 작년보다 " + CheckpointRules.DEBT_RATIO_CHANGE + "%p 이상 높아졌거나 자본총계가 0 이하(자본잠식)면 확인해 볼 점"),
    SHORT_TERM_BORROWINGS("단기 차입금",
            "1년 안에 갚아야 하는 차입금이 매출보다 빨리 늘면 차입 조건과 만기 구조를 주석에서 함께 살펴보는 경우가 많아요.",
            "단기 차입금 = 단기차입금 + 유동성장기부채(두 해 모두 찾은 계정만), 차이 = 단기 차입금 증가율 − 매출 증가율",
            "단기 차입금 증가율 − 매출 증가율이 " + CheckpointRules.BORROWINGS_GAP + "%p 이상이면 확인해 볼 점"),
    FUNDING_DISCLOSURES("자금 조달 공시",
            "유상증자·전환사채 같은 자금 조달 공시는 발행 주식 수가 늘어날 수 있는지(희석) 살펴보는 계기가 돼요. "
                    + "조달 목적과 조건은 각 공시 원문에 있어요.",
            "최근 1년 공시 가운데 '자금 조달' 묶음 공시 건수",
            "최근 1년 '자금 조달' 묶음 공시가 " + CheckpointRules.FUNDING_COUNT + "건 이상이면 확인해 볼 점"),
    AUDIT_OPINION("감사의견",
            "감사의견은 외부 감사인이 재무제표를 살펴보고 적은 의견이에요. 적정이 아닌 의견이 있으면 그 사유를 감사보고서에서 "
                    + "함께 읽어 보는 경우가 많아요.",
            "최근 1년 사업보고서의 당기 감사의견 가운데 적정이 아닌 의견(한정·부적정·의견거절) 건수",
            "최근 1년 사업보고서 감사의견에 적정이 아닌 의견이 " + CheckpointRules.AUDIT_COUNT + "건 이상이면 확인해 볼 점");

    private final String title;
    private final String why;
    private final String formula;
    private final String threshold;

    CheckpointKey(String title, String why, String formula, String threshold) {
        this.title = title;
        this.why = why;
        this.formula = formula;
        this.threshold = threshold;
    }

    public String title() {
        return title;
    }

    public String why() {
        return why;
    }

    public String formula() {
        return formula;
    }

    public String threshold() {
        return threshold;
    }
}
