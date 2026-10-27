package com.dartinsight.keyfact.domain;

import com.dartinsight.keyfact.domain.KeyFactChange.Type;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;

/**
 * 두 보고서의 같은 행을 짝지어 바뀐 항목을 만든다(docs/api-spec.md key-facts). 값은 원문 그대로 옮기고 계산하지 않는다.
 * 순서: 현재 보고서 순서로 추가·변경, 그다음 이전 보고서 순서로 빠진 항목.
 */
public final class KeyFactChanges {

    static final String CASH_DIVIDEND_PER_SHARE = "주당 현금배당금";

    private KeyFactChanges() {
    }

    /** 성명 + 주식 종류로 짝짓는다. 기말 지분율이 다르면 그 값, 같고 기말 주식 수만 다르면 그 값. */
    public static List<KeyFactChange> majorShareholders(List<MajorShareholder> previous, List<MajorShareholder> current) {
        Map<String, MajorShareholder> before = index(previous, r -> key(r.name(), r.stockKind()));
        Map<String, MajorShareholder> after = index(current, r -> key(r.name(), r.stockKind()));
        List<KeyFactChange> changes = new ArrayList<>();
        after.forEach((key, now) -> {
            MajorShareholder old = before.get(key);
            if (old == null) {
                changes.add(new KeyFactChange(Type.ADDED, now.name(), now.stockKind(), "endRatio", null,
                        now.endRatio()));
            } else if (!Objects.equals(old.endRatio(), now.endRatio())) {
                changes.add(new KeyFactChange(Type.CHANGED, now.name(), now.stockKind(), "endRatio", old.endRatio(),
                        now.endRatio()));
            } else if (!Objects.equals(old.endShares(), now.endShares())) {
                changes.add(new KeyFactChange(Type.CHANGED, now.name(), now.stockKind(), "endShares",
                        old.endShares(), now.endShares()));
            }
        });
        before.forEach((key, old) -> {
            if (!after.containsKey(key)) {
                changes.add(new KeyFactChange(Type.REMOVED, old.name(), old.stockKind(), "endRatio", old.endRatio(),
                        null));
            }
        });
        return changes;
    }

    /** 성명으로 짝짓는다(같은 이름이 둘 이상이면 처음 것). 직위·등기 구분이 다르면 필드마다 한 건. */
    public static List<KeyFactChange> executives(List<Executive> previous, List<Executive> current) {
        Map<String, Executive> before = index(previous, Executive::name);
        Map<String, Executive> after = index(current, Executive::name);
        List<KeyFactChange> changes = new ArrayList<>();
        after.forEach((name, now) -> {
            Executive old = before.get(name);
            if (old == null) {
                changes.add(new KeyFactChange(Type.ADDED, now.name(), null, "position", null, now.position()));
                return;
            }
            if (!Objects.equals(old.position(), now.position())) {
                changes.add(new KeyFactChange(Type.CHANGED, now.name(), null, "position", old.position(),
                        now.position()));
            }
            if (!Objects.equals(old.registeredType(), now.registeredType())) {
                changes.add(new KeyFactChange(Type.CHANGED, now.name(), null, "registeredType",
                        old.registeredType(), now.registeredType()));
            }
        });
        before.forEach((name, old) -> {
            if (!after.containsKey(name)) {
                changes.add(new KeyFactChange(Type.REMOVED, old.name(), null, "position", old.position(), null));
            }
        });
        return changes;
    }

    /** 구분 + 주식 종류로 짝짓고, 주당 현금배당금 행의 당기 값이 다를 때만 만든다. */
    public static List<KeyFactChange> dividends(List<Dividend> previous, List<Dividend> current) {
        Map<String, Dividend> before = index(previous, r -> key(r.category(), r.stockKind()));
        List<KeyFactChange> changes = new ArrayList<>();
        index(current, r -> key(r.category(), r.stockKind())).forEach((key, now) -> {
            Dividend old = before.get(key);
            if (old != null && now.category() != null && now.category().startsWith(CASH_DIVIDEND_PER_SHARE)
                    && !Objects.equals(old.currentTerm(), now.currentTerm())) {
                changes.add(new KeyFactChange(Type.CHANGED, now.category(), now.stockKind(), "currentTerm",
                        old.currentTerm(), now.currentTerm()));
            }
        });
        return changes;
    }

    private static String key(String name, String stockKind) {
        return name == null ? null : name + "\u0000" + (stockKind == null ? "" : stockKind);
    }

    /** 이름이 없는 행은 짝지을 수 없어 뺀다. */
    private static <T> Map<String, T> index(List<T> rows, Function<T, String> key) {
        Map<String, T> map = new LinkedHashMap<>();
        for (T row : rows) {
            String k = key.apply(row);
            if (k != null) {
                map.putIfAbsent(k, row);
            }
        }
        return map;
    }
}
