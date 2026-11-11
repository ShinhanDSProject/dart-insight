package com.dartinsight.activity.domain;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 저장된 사이 기간 공시 목록(ADR-0068).
 *
 * @param fetchedAt 받은 시각
 * @param items     접수일이 이른 순서
 */
public record PeriodDisclosures(LocalDateTime fetchedAt, List<PeriodDisclosure> items) {
}
