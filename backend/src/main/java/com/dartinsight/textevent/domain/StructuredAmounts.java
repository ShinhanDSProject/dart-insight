package com.dartinsight.textevent.domain;

import com.dartinsight.disclosure.domain.DisclosureKeyItems;
import com.dartinsight.disclosure.domain.KeyItem;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.regex.Pattern;

/**
 * 핵심 수치에서 사건 규모로 쓸 금액을 고른다(ADR-0053). 필드는 OpenDART 개발가이드 DS005에 있는 원화 금액 필드다.
 * 결정 하나에 금액 하나를 주므로, 나뉜 항목(자금조달 목적별 등)은 그 결정 안에서 더한다.
 */
public final class StructuredAmounts {

    private static final String CURRENCY = "KRW";
    private static final Pattern WHOLE_NUMBER = Pattern.compile("\\d{1,18}");

    private StructuredAmounts() {
    }

    /** 쓸 수 있는 금액이 없으면 비어 있다 */
    public static Optional<StructuredAmount> of(DisclosureKeyItems keyItems) {
        Fields fields = switch (keyItems.kind()) {
            case CAPITAL_INCREASE -> new Fields("fdpp", List.of("fdpp_fclt", "fdpp_bsninh", "fdpp_op", "fdpp_dtrp",
                    "fdpp_ocsa", "fdpp_etc"));
            case CONVERTIBLE_BOND, BOND_WITH_WARRANT, EXCHANGEABLE_BOND -> new Fields("bd_fta", List.of("bd_fta"));
            case TREASURY_STOCK_ACQUISITION -> new Fields("aqpln_prc", List.of("aqpln_prc_ostk", "aqpln_prc_estk"));
            case TREASURY_STOCK_DISPOSAL -> new Fields("dppln_prc", List.of("dppln_prc_ostk", "dppln_prc_estk"));
            case STOCK_ACQUISITION -> new Fields("inhdtl_inhprc", List.of("inhdtl_inhprc"));
            case LITIGATION -> new Fields(null, List.of());
        };
        List<String> used = new ArrayList<>();
        long total = 0;
        for (KeyItem item : keyItems.items()) {
            Long amount = fields.names().contains(item.field()) ? amount(item.value()) : null;
            if (amount != null) {
                used.add(item.field());
                total += amount;
            }
        }
        if (used.isEmpty()) {
            return Optional.empty();
        }
        String rceptNo = keyItems.sourceRceptNo() == null ? keyItems.rceptNo() : keyItems.sourceRceptNo();
        return Optional.of(new StructuredAmount(rceptNo, keyItems.kind(),
                used.size() == 1 ? used.getFirst() : fields.summedName(), total, CURRENCY));
    }

    /** 쉼표를 뺀 양의 정수. 숫자가 아니거나 0이면 null */
    private static Long amount(String value) {
        String digits = value == null ? "" : value.replace(",", "").trim();
        if (!WHOLE_NUMBER.matcher(digits).matches()) {
            return null;
        }
        long amount = Long.parseLong(digits);
        return amount > 0 ? amount : null;
    }

    private record Fields(String summedName, List<String> names) {
    }
}
