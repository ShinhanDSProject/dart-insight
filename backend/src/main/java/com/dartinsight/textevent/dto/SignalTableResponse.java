package com.dartinsight.textevent.dto;

import com.dartinsight.textevent.domain.GlossaryTerm;
import com.dartinsight.textevent.domain.SignalTable;
import java.util.List;

/** 사건 신호 기준표(GET /api/signal-tables/current). 모양은 ai-server 내부 API와 같다(docs/api-spec.md). */
public record SignalTableResponse(String version, String signalNotice, List<SignalTable.Kind> kinds,
        List<GlossaryTerm> glossary) {

    public static SignalTableResponse from(SignalTable table) {
        return new SignalTableResponse(table.version(), table.signalNotice(), table.kinds(), table.glossary());
    }
}
