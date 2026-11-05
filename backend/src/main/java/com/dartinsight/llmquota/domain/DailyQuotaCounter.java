package com.dartinsight.llmquota.domain;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.Map;

/**
 * 하루 동안 호출자별·전체 횟수를 센다(ADR-0054). 날짜가 바뀌면 모두 0부터 다시 센다.
 * 한도를 넘은 요청은 세지 않는다. 서버 한 대의 메모리에만 두므로 재시작하면 초기화된다.
 */
public class DailyQuotaCounter {

    private LocalDate day;
    private final Map<String, Integer> byCaller = new HashMap<>();
    private int total;

    /** 오늘 한 번 더 써도 되면 세고 ALLOWED, 아니면 걸린 한도를 돌려준다(세지 않음) */
    public synchronized QuotaDecision acquire(String caller, int callerLimit, int totalLimit, LocalDate today) {
        if (!today.equals(day)) {
            day = today;
            byCaller.clear();
            total = 0;
        }
        if (total >= totalLimit) {
            return QuotaDecision.TOTAL_EXCEEDED;
        }
        int used = byCaller.getOrDefault(caller, 0);
        if (used >= callerLimit) {
            return QuotaDecision.CALLER_EXCEEDED;
        }
        byCaller.put(caller, used + 1);
        total++;
        return QuotaDecision.ALLOWED;
    }
}
