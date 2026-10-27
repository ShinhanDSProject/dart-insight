package com.dartinsight.disclosure.domain;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * 핵심 수치를 보여 줄 수 있는 주요사항보고서 종류(docs/api-spec.md 공통 값 keyItemsKind, FS-51).
 * 종류마다 OpenDART 주요사항보고서 주요정보(DS005) API 하나에 대응하고, 보여 줄 항목(필드·이름·단위)을 순서대로 둔다.
 *
 * <p>필드 이름·항목 이름·단위는 OpenDART 개발가이드(apiGrpCd=DS005)의 응답 표에서 그대로 옮겼다. 단위는 가이드가
 * 항목 이름 괄호에 적은 것(원, 주, %, 원/주)이고, 없으면 null이다. 해외 발행(통화가 따로 있는 금액)과 이사회 참석 같은
 * 절차 항목은 넣지 않는다. 항목을 더할 때도 가이드에 있는 필드만 더한다.
 */
public enum KeyItemKind {

    /** 유상증자 결정(piicDecsn, apiId 2020023) */
    CAPITAL_INCREASE("유상증자 결정", fields(
            f("nstk_ostk_cnt", "신주의 종류와 수(보통주식)", "주"),
            f("nstk_estk_cnt", "신주의 종류와 수(기타주식)", "주"),
            f("fv_ps", "1주당 액면가액", "원"),
            f("bfic_tisstk_ostk", "증자전 발행주식총수(보통주식)", "주"),
            f("bfic_tisstk_estk", "증자전 발행주식총수(기타주식)", "주"),
            f("ic_mthn", "증자방식", null)),
            fundingPurposes()),

    /** 전환사채권 발행결정(cvbdIsDecsn, apiId 2020033) */
    CONVERTIBLE_BOND("전환사채권 발행결정", bond(), fields(
            f("cv_prc", "전환가액", "원/주"),
            f("cvisstk_knd", "전환에 따라 발행할 주식(종류)", null),
            f("cvisstk_cnt", "전환에 따라 발행할 주식(주식수)", "주"),
            f("cvisstk_tisstk_vs", "전환에 따라 발행할 주식(주식총수 대비 비율)", "%"),
            f("cvrqpd_bgd", "전환청구기간(시작일)", null),
            f("cvrqpd_edd", "전환청구기간(종료일)", null),
            f("act_mktprcfl_cvprc_lwtrsprc", "시가하락에 따른 전환가액 조정(최저 조정가액)", "원")),
            fundingPurposes(), schedule()),

    /** 신주인수권부사채권 발행결정(bdwtIsDecsn, apiId 2020034) */
    BOND_WITH_WARRANT("신주인수권부사채권 발행결정", bond(), fields(
            f("ex_prc", "행사가액", "원/주"),
            f("bdwt_div_atn", "사채와 인수권의 분리여부", null),
            f("nstk_isstk_knd", "신주인수권 행사에 따라 발행할 주식(종류)", null),
            f("nstk_isstk_cnt", "신주인수권 행사에 따라 발행할 주식(주식수)", "주"),
            f("nstk_isstk_tisstk_vs", "신주인수권 행사에 따라 발행할 주식(주식총수 대비 비율)", "%"),
            f("expd_bgd", "권리행사기간(시작일)", null),
            f("expd_edd", "권리행사기간(종료일)", null),
            f("act_mktprcfl_cvprc_lwtrsprc", "시가하락에 따른 행사가액 조정(최저 조정가액)", "원")),
            fundingPurposes(), schedule()),

    /** 교환사채권 발행결정(exbdIsDecsn, apiId 2020035) */
    EXCHANGEABLE_BOND("교환사채권 발행결정", bond(), fields(
            f("ex_prc", "교환가액", "원/주"),
            f("extg", "교환대상(종류)", null),
            f("extg_stkcnt", "교환대상(주식수)", "주"),
            f("extg_tisstk_vs", "교환대상(주식총수 대비 비율)", "%"),
            f("exrqpd_bgd", "교환청구기간(시작일)", null),
            f("exrqpd_edd", "교환청구기간(종료일)", null)),
            fundingPurposes(), schedule()),

    /** 자기주식 취득 결정(tsstkAqDecsn, apiId 2020038) */
    TREASURY_STOCK_ACQUISITION("자기주식 취득 결정", fields(
            f("aqpln_stk_ostk", "취득예정주식(보통주식)", "주"),
            f("aqpln_stk_estk", "취득예정주식(기타주식)", "주"),
            f("aqpln_prc_ostk", "취득예정금액(보통주식)", "원"),
            f("aqpln_prc_estk", "취득예정금액(기타주식)", "원"),
            f("aqexpd_bgd", "취득예상기간(시작일)", null),
            f("aqexpd_edd", "취득예상기간(종료일)", null),
            f("hdexpd_bgd", "보유예상기간(시작일)", null),
            f("hdexpd_edd", "보유예상기간(종료일)", null),
            f("aq_pp", "취득목적", null),
            f("aq_mth", "취득방법", null),
            f("cs_iv_bk", "위탁투자중개업자", null),
            f("aq_dd", "취득결정일", null))),

    /** 자기주식 처분 결정(tsstkDpDecsn, apiId 2020039) */
    TREASURY_STOCK_DISPOSAL("자기주식 처분 결정", fields(
            f("dppln_stk_ostk", "처분예정주식(보통주식)", "주"),
            f("dppln_stk_estk", "처분예정주식(기타주식)", "주"),
            f("dpstk_prc_ostk", "처분 대상 주식가격(보통주식)", "원"),
            f("dpstk_prc_estk", "처분 대상 주식가격(기타주식)", "원"),
            f("dppln_prc_ostk", "처분예정금액(보통주식)", "원"),
            f("dppln_prc_estk", "처분예정금액(기타주식)", "원"),
            f("dpprpd_bgd", "처분예정기간(시작일)", null),
            f("dpprpd_edd", "처분예정기간(종료일)", null),
            f("dp_pp", "처분목적", null),
            f("dp_m_mkt", "처분방법(시장을 통한 매도)", "주"),
            f("dp_m_ovtm", "처분방법(시간외대량매매)", "주"),
            f("dp_m_otc", "처분방법(장외처분)", "주"),
            f("dp_m_etc", "처분방법(기타)", "주"),
            f("cs_iv_bk", "위탁투자중개업자", null),
            f("dp_dd", "처분결정일", null))),

    /** 소송 등의 제기(lwstLg, apiId 2020028). 관련 수시공시(3.6)가 원고·사건 명칭을 대조한다 */
    LITIGATION("소송 등의 제기", fields(
            f("icnm", "사건의 명칭", null),
            f("ac_ap", "원고ㆍ신청인", null),
            f("rq_cn", "청구내용", null),
            f("cpct", "관할법원", null),
            f("lgd", "제기일자", null))),

    /** 타법인 주식 및 출자증권 양수결정(otcprStkInvscrInhDecsn, apiId 2020046). 관련 수시공시(3.6)가 발행회사를 대조한다 */
    STOCK_ACQUISITION("타법인 주식 및 출자증권 양수결정", fields(
            f("iscmp_cmpnm", "발행회사(회사명)", null),
            f("inhdtl_stkcnt", "양수내역(양수주식수)", "주"),
            f("inhdtl_inhprc", "양수내역(양수금액)", "원"),
            f("atinh_eqrt", "양수후 소유주식수 및 지분비율(지분비율)", "%"),
            f("dlptn_cmpnm", "거래상대방(회사명(성명))", null)));

    /** 보여 줄 항목 하나. @param unit 개발가이드의 단위, 없으면 null */
    public record Field(String field, String label, String unit) {
    }

    private final String label;
    private final List<Field> fields;

    @SafeVarargs
    KeyItemKind(String label, List<Field>... groups) {
        this.label = label;
        List<Field> all = new ArrayList<>();
        for (List<Field> group : groups) {
            all.addAll(group);
        }
        this.fields = List.copyOf(all);
    }

    public String label() {
        return label;
    }

    public List<Field> fields() {
        return fields;
    }

    /**
     * OpenDART 응답 행 하나에서 정한 항목을 정한 순서로 꺼낸다. 값은 앞뒤 공백만 빼고 원문 그대로 두며(쉼표·날짜 표기 포함),
     * '-'이거나 비어 있는 항목은 뺀다. 새 숫자를 만들지 않는다.
     */
    public List<KeyItem> items(Map<String, String> row) {
        List<KeyItem> items = new ArrayList<>();
        for (Field field : fields) {
            String value = row.get(field.field());
            String text = value == null ? "" : value.strip();
            if (text.isEmpty() || "-".equals(text)) {
                continue;
            }
            items.add(new KeyItem(field.field(), field.label(), text, field.unit()));
        }
        return List.copyOf(items);
    }

    private static Field f(String field, String label, String unit) {
        return new Field(field, label, unit);
    }

    private static List<Field> fields(Field... fields) {
        return List.of(fields);
    }

    /** 사채 세 종류(전환·신주인수권부·교환)에 공통인 사채 항목 */
    private static List<Field> bond() {
        return fields(
                f("bd_tm", "사채의 종류(회차)", null),
                f("bd_knd", "사채의 종류(종류)", null),
                f("bd_fta", "사채의 권면(전자등록)총액", "원"),
                f("bd_intr_ex", "사채의 이율(표면이자율)", "%"),
                f("bd_intr_sf", "사채의 이율(만기이자율)", "%"),
                f("bd_mtd", "사채만기일", null),
                f("bdis_mthn", "사채발행방법", null));
    }

    /** 유상증자·사채 공통 자금조달의 목적 */
    private static List<Field> fundingPurposes() {
        return fields(
                f("fdpp_fclt", "자금조달의 목적(시설자금)", "원"),
                f("fdpp_bsninh", "자금조달의 목적(영업양수자금)", "원"),
                f("fdpp_op", "자금조달의 목적(운영자금)", "원"),
                f("fdpp_dtrp", "자금조달의 목적(채무상환자금)", "원"),
                f("fdpp_ocsa", "자금조달의 목적(타법인 증권 취득자금)", "원"),
                f("fdpp_etc", "자금조달의 목적(기타자금)", "원"));
    }

    /** 사채 공통 일정 */
    private static List<Field> schedule() {
        return fields(
                f("sbd", "청약일", null),
                f("pymd", "납입일", null),
                f("bddd", "이사회결의일(결정일)", null));
    }
}
