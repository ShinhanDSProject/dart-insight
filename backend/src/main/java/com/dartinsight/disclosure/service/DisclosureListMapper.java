package com.dartinsight.disclosure.service;

import com.dartinsight.dart.dto.DisclosureListResponse;
import com.dartinsight.disclosure.domain.Disclosure;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * OpenDART 공시검색 응답 줄을 저장할 {@link Disclosure}로 옮긴다. 응답 dto를 받으므로 domain이 아니라 이 패키지에 둔다(계층 규칙).
 * 상태가 없다.
 */
final class DisclosureListMapper {

    private static final Logger log = LoggerFactory.getLogger(DisclosureListMapper.class);

    private DisclosureListMapper() {
    }

    /** 이 기업의 공시가 아니거나 접수번호·접수일을 읽을 수 없는 줄은 뺀다. 같은 접수번호는 한 번만 둔다. */
    static List<Disclosure> toDisclosures(String corpCode, List<DisclosureListResponse.Item> items) {
        Map<String, Disclosure> byRceptNo = new LinkedHashMap<>();
        int skipped = 0;
        for (DisclosureListResponse.Item item : items) {
            LocalDate rceptDt = parseDate(item.rceptDt());
            if (item.rceptNo() == null || item.rceptNo().isBlank() || rceptDt == null || item.reportName() == null
                    || !corpCode.equals(item.corpCode())) {
                skipped++;
                continue;
            }
            byRceptNo.putIfAbsent(item.rceptNo(), new Disclosure(item.rceptNo().trim(), item.reportName().strip(),
                    blankToNull(item.filerName()), rceptDt, blankToNull(item.remark())));
        }
        if (skipped > 0) {
            log.info("최근 공시 목록에서 읽을 수 없는 줄 {}건을 뺐습니다: {}", skipped, corpCode);
        }
        return List.copyOf(byRceptNo.values());
    }

    private static LocalDate parseDate(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return LocalDate.parse(value.trim(), DateTimeFormatter.BASIC_ISO_DATE);
        } catch (DateTimeParseException e) {
            return null;
        }
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.strip();
    }
}
