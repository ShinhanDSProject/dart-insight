package com.dartinsight.textevent.service;

import com.dartinsight.common.error.ApiException;
import com.dartinsight.disclosure.domain.KeyItemRules;
import com.dartinsight.disclosure.domain.KeyItemTarget;
import com.dartinsight.disclosure.service.DisclosureKeyItemService;
import com.dartinsight.relateddisclosure.domain.DisclosureDetailType;
import com.dartinsight.relateddisclosure.domain.DisclosureWindow;
import com.dartinsight.relateddisclosure.domain.WindowDisclosure;
import com.dartinsight.relateddisclosure.service.DisclosureWindowService;
import com.dartinsight.textevent.domain.StructuredAmount;
import com.dartinsight.textevent.domain.StructuredAmounts;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * 비교 기간의 주요사항보고서(B001)에서 사건 규모로 쓸 금액을 모은다(ADR-0053). 이미 있는 기간 공시·핵심 수치 캐시를 쓴다.
 * 없어도 글에서 읽은 금액으로 사건을 만들 수 있으므로, OpenDART를 부르지 못하면 빈 목록으로 넘어간다.
 * 비고 '정'인 원본은 나중 정정본과 같은 결정이라 세지 않는다.
 */
@Service
@RequiredArgsConstructor
public class StructuredAmountLoader {

    private static final Logger log = LoggerFactory.getLogger(StructuredAmountLoader.class);

    private final DisclosureWindowService windowService;
    private final DisclosureKeyItemService keyItemService;

    public List<StructuredAmount> load(DisclosureWindow window) {
        try {
            List<StructuredAmount> amounts = new ArrayList<>();
            for (WindowDisclosure disclosure : windowService.load(window).items()) {
                target(disclosure)
                        .map(target -> keyItemService.load(window.corpCode(), target))
                        .flatMap(StructuredAmounts::of)
                        .ifPresent(amounts::add);
            }
            return amounts;
        } catch (ApiException e) {
            log.warn("주요 사건에 쓸 공시 금액을 받지 못해 글에서 읽은 금액만 씁니다: {}", e.errorCode());
            return List.of();
        }
    }

    private static Optional<KeyItemTarget> target(WindowDisclosure disclosure) {
        if (disclosure.detailType() != DisclosureDetailType.B001) {
            return Optional.empty();
        }
        return KeyItemRules.classify(disclosure.reportName())
                .map(kind -> KeyItemTarget.of(disclosure.rceptNo(), disclosure.reportName(), disclosure.rceptDt(),
                        kind, disclosure.remark()))
                .filter(target -> !target.correctedLater());
    }
}
