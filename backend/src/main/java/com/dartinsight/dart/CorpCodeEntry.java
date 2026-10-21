package com.dartinsight.dart;

import java.time.LocalDate;

/**
 * corpCode.xml의 회사 한 건.
 *
 * @param stockCode 종목코드. 비상장사는 null
 */
public record CorpCodeEntry(String corpCode, String corpName, String corpEngName, String stockCode,
        LocalDate modifyDate) {
}
