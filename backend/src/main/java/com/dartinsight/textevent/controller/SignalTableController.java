package com.dartinsight.textevent.controller;

import com.dartinsight.common.web.ApiPaths;
import com.dartinsight.textevent.dto.SignalTableResponse;
import com.dartinsight.textevent.service.SignalTableService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 사건 신호 기준표(3.40, ADR-0060). 신호 이유의 '기준 보기'에 쓴다. */
@RestController
@RequestMapping(ApiPaths.SIGNAL_TABLES)
@RequiredArgsConstructor
public class SignalTableController {

    private final SignalTableService signalTableService;

    @GetMapping(ApiPaths.CURRENT)
    public SignalTableResponse current() {
        return SignalTableResponse.from(signalTableService.current());
    }
}
