package com.dartinsight.disclosure.service;

import com.dartinsight.dart.client.OpenDartClient.PeriodicReportInfoPage;
import com.dartinsight.dart.dto.AuditOpinionItem;
import com.dartinsight.disclosure.domain.AuditOpinionRow;
import com.dartinsight.disclosure.domain.AuditOpinions;
import com.dartinsight.disclosure.domain.DisclosureSignalRules;
import com.dartinsight.report.domain.ReportNameParser.ParsedReportName;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeParseException;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * OpenDART 회계감사인의 명칭 및 감사의견 응답(DS002 2020009)을 사업보고서 한 건의 {@link AuditOpinions}로 옮긴다.
 * 응답 dto를 받으므로 domain이 아니라 이 패키지에 둔다(계층 규칙). 상태가 없다.
 */
final class AuditOpinionMapper {

    private static final Logger log = LoggerFactory.getLogger(AuditOpinionMapper.class);

    private AuditOpinionMapper() {
    }

    /**
     * 정기보고서 주요정보와 같은 행 고르기(KeyFactService): 이 보고서 접수번호의 행이 있으면 그 행만, 없으면 첫 행의 접수번호와
     * 같은 행만 쓴다. 접수번호가 없는 행은 근거가 없어 쓰지 않는다. 결산기준일이 보고서의 대상 기간 끝과 다르면 NO_DATA다.
     */
    static AuditOpinions toOpinions(String rceptNo, ParsedReportName parsed, PeriodicReportInfoPage<AuditOpinionItem> page,
            LocalDateTime now) {
        List<AuditOpinionItem> withRceptNo = page.noData() ? List.of() : page.items().stream()
                .filter(item -> clean(item.rceptNo()) != null)
                .toList();
        if (withRceptNo.isEmpty()) {
            return new AuditOpinions(rceptNo, false, null, List.of(), now);
        }
        String source = withRceptNo.stream()
                .map(item -> clean(item.rceptNo()))
                .filter(rceptNo::equals)
                .findFirst()
                .orElseGet(() -> clean(withRceptNo.get(0).rceptNo()));
        List<AuditOpinionItem> items = withRceptNo.stream()
                .filter(item -> source.equals(clean(item.rceptNo())))
                .toList();
        LocalDate settlementDate = date(items.get(0).settlementDate());
        if (settlementDate != null && !settlementDate.equals(parsed.periodEnd())) {
            log.info("감사의견이 다른 기간의 것이라 쓰지 않습니다 {}: 결산기준일 {}", rceptNo, settlementDate);
            return new AuditOpinions(rceptNo, false, null, List.of(), now);
        }
        Set<AuditOpinionRow> rows = new LinkedHashSet<>();
        for (AuditOpinionItem item : items) {
            rows.add(new AuditOpinionRow(DisclosureSignalRules.compact(clean(item.term())), clean(item.auditor()),
                    clean(item.opinion()), clean(item.emphasisMatter()), clean(item.specialMatter()),
                    clean(item.keyAuditMatter())));
        }
        return new AuditOpinions(rceptNo, true, source.equals(rceptNo) ? null : source, List.copyOf(rows), now);
    }

    /** 원문 값 그대로. 앞뒤 공백만 지우고, '-'·빈 값은 null */
    private static String clean(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.strip();
        return trimmed.isEmpty() || "-".equals(trimmed) ? null : trimmed;
    }

    private static LocalDate date(String value) {
        String cleaned = clean(value);
        if (cleaned == null) {
            return null;
        }
        try {
            return LocalDate.parse(cleaned);
        } catch (DateTimeParseException e) {
            return null;
        }
    }
}
