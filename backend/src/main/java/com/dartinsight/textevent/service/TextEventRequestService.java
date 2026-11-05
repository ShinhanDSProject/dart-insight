package com.dartinsight.textevent.service;

import com.dartinsight.analysis.domain.Analysis;
import com.dartinsight.analysis.domain.ChangeScales;
import com.dartinsight.analysis.domain.FinancialChange;
import com.dartinsight.analysis.domain.TextChange;
import com.dartinsight.analysis.domain.TextChangeRow.Side;
import com.dartinsight.analysis.service.AnalysisResultService;
import com.dartinsight.analysis.service.TextChangeQueryService;
import com.dartinsight.analysis.service.TextChangeQueryService.CompletedTextChanges;
import com.dartinsight.document.domain.DocumentBlock;
import com.dartinsight.document.service.DocumentService;
import com.dartinsight.relateddisclosure.domain.DisclosureWindow;
import com.dartinsight.report.domain.Report;
import com.dartinsight.report.service.ReportService;
import com.dartinsight.textevent.domain.StructuredAmount;
import com.dartinsight.textevent.dto.TextEventAiRequest;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/** 저장된 분석 결과로 주요 사건 요청을 만든다. OpenDART를 부를 수 있으므로 트랜잭션 밖에서 부른다(LY-2). */
@Service
@RequiredArgsConstructor
public class TextEventRequestService {

    private final TextChangeQueryService textChangeQueryService;
    private final AnalysisResultService analysisResultService;
    private final ReportService reportService;
    private final DocumentService documentService;
    private final StructuredAmountLoader structuredAmountLoader;

    public Input build(Long analysisId) {
        CompletedTextChanges completed = textChangeQueryService.completedChanges(analysisId);
        Analysis analysis = completed.analysis();
        Report current = reportService.report(analysis.getCurrentRceptNo());
        Report previous = reportService.report(analysis.getPreviousRceptNo());
        List<TextChange> candidates = TextEventRequests.candidates(completed.changes());
        List<StructuredAmount> amounts = structuredAmountLoader.load(new DisclosureWindow(analysis.getCorpCode(),
                previous.getPeriodEnd(), current.getPeriodEnd(), current.getRceptDt()));
        FinancialChange equity = ChangeScales.of(analysisResultService.completedResult(analysisId).changes())
                .equityTotal().orElse(null);
        TextEventAiRequest request = TextEventRequests.of(analysis.getPreviousRceptNo(),
                analysis.getCurrentRceptNo(), equity == null ? null : equity.getCurrentAmount(),
                equity == null ? null : equity.getCurrency(), current.getPeriodEnd().toString(), amounts, candidates,
                blocksOfTables(candidates));
        return new Input(request, amounts, candidates.stream()
                .collect(Collectors.toMap(TextChange::changeNo, Function.identity())));
    }

    /** 표 변경이 있는 보고서의 블록. 표가 없으면 원문을 읽지 않는다 */
    private Map<String, Map<Integer, DocumentBlock>> blocksOfTables(List<TextChange> candidates) {
        return candidates.stream().map(TextEventRequests::tableSide).filter(Objects::nonNull).map(Side::rceptNo)
                .distinct().collect(Collectors.toMap(Function.identity(), this::blocks));
    }

    private Map<Integer, DocumentBlock> blocks(String rceptNo) {
        return documentService.find(rceptNo).map(documentService::blocks).orElse(List.of()).stream()
                .collect(Collectors.toMap(DocumentBlock::blockNo, Function.identity()));
    }

    /**
     * @param amounts 보낸 공시 금액
     * @param sent    변경 번호 → 보낸 변경
     */
    public record Input(TextEventAiRequest request, List<StructuredAmount> amounts, Map<Integer, TextChange> sent) {
    }
}
