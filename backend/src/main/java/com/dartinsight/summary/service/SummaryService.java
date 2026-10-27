package com.dartinsight.summary.service;

import com.dartinsight.aiserver.client.AiServerClient;
import com.dartinsight.aiserver.client.AiServerException;
import com.dartinsight.aiserver.client.AiServerPaths;
import com.dartinsight.analysis.domain.FinancialChangeRow;
import com.dartinsight.analysis.domain.TextChangeRow;
import com.dartinsight.document.domain.DocumentBlock;
import com.dartinsight.document.domain.DocumentSection;
import com.dartinsight.document.domain.ReportDocument;
import com.dartinsight.document.service.DocumentService;
import com.dartinsight.summary.domain.FinancialFacts;
import com.dartinsight.summary.domain.LlmCallRow;
import com.dartinsight.summary.domain.SummaryItemRow;
import com.dartinsight.summary.domain.SummaryResult;
import com.dartinsight.summary.domain.SummaryStatus;
import com.dartinsight.summary.dto.SummaryAiRequest;
import com.dartinsight.summary.dto.SummaryAiResponse;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * 근거 기반 요약(3.2). 코드가 요약할 변화를 고르고 사실 문장(수치)을 만들며, AI 서버(LLM)는 문장 변화의 요약과
 * 공시에 적힌 설명만 쓴다. AI 서버가 근거·숫자를 확인해 통과하지 못한 항목은 '검토 필요'로 돌려준다.
 * AI 서버·LLM을 부를 수 없으면 {@link com.dartinsight.aiserver.client.AiServerException}을 그대로 던진다(분석 실패).
 */
@Service
@RequiredArgsConstructor
public class SummaryService {

    private final AiServerClient aiServerClient;
    private final DocumentService documentService;

    public SummaryResult summarize(String companyName, String previousReport, String currentReport,
            String currentRceptNo, List<FinancialChangeRow> financial, List<TextChangeRow> text) {
        List<Integer> financialPicked = SummarySelector.financial(financial);
        List<Integer> textPicked = SummarySelector.text(text);
        if (financialPicked.isEmpty() && textPicked.isEmpty()) {
            return SummaryResult.empty("요약할 변화가 없어요.");
        }
        // 재무 설명 후보는 AI 서버가 이 문단들에서 검색어로 고른다(ADR-0036)
        List<SummaryAiRequest.Source> paragraphs = paragraphs(currentRceptNo);
        Map<String, Integer> financialRefs = SummaryResults.refs(SummaryResults.FINANCIAL_REF, financialPicked);
        List<SummaryAiRequest.FinancialItem> financialItems = financialPicked.stream()
                .map(i -> SummaryResults.financialItem(financial.get(i), i)).toList();
        Map<String, Integer> textRefs = SummaryResults.refs(SummaryResults.TEXT_REF, textPicked);
        List<SummaryAiRequest.TextItem> textItems = textPicked.stream()
                .map(i -> SummaryResults.textItem(text.get(i), i)).toList();

        if (textItems.isEmpty() && paragraphs.isEmpty()) {
            // LLM이 쓸 것이 없으면(문장 변화도 설명을 찾을 원문도 없음) AI 서버를 부르지 않는다
            List<SummaryItemRow> rows = financialPicked.stream()
                    .map(i -> SummaryResults.notFound(FinancialFacts.sentence(financial.get(i)), i, null))
                    .toList();
            return new SummaryResult(SummaryStatus.COMPLETED, null, rows, List.of());
        }

        SummaryAiResponse response = requestSummaries(new SummaryAiRequest(companyName, previousReport,
                currentReport, textItems, financialItems, paragraphs));
        LocalDateTime generatedAt = SummaryResults.time(response.generatedAt());
        Map<String, SummaryAiResponse.Item> answers = SummaryResults.answers(response,
                ref -> textRefs.containsKey(ref) || financialRefs.containsKey(ref));
        List<SummaryItemRow> rows = new ArrayList<>();
        for (SummaryAiRequest.TextItem item : textItems) {
            rows.add(SummaryResults.textRow(answers.get(item.ref()), textRefs.get(item.ref()) + 1,
                    SummaryResults.ids(item.sources()), response, generatedAt));
        }
        Set<String> paragraphIds = SummaryResults.ids(paragraphs);
        for (SummaryAiRequest.FinancialItem item : financialItems) {
            int index = financialRefs.get(item.ref());
            rows.add(SummaryResults.financialRow(answers.get(item.ref()), index, financial.get(index), paragraphIds,
                    response, generatedAt));
        }
        return SummaryResults.result(rows, response);
    }

    /** 현재 보고서의 문단 블록 전부(설명 후보를 찾을 곳). 쓸 수 있는 원문이 없으면 빈 목록 */
    private List<SummaryAiRequest.Source> paragraphs(String currentRceptNo) {
        Optional<ReportDocument> document = documentService.find(currentRceptNo).filter(d -> d.getStatus().usable());
        List<DocumentSection> sections = document.map(documentService::sections).orElse(List.of());
        List<DocumentBlock> blocks = document.map(documentService::blocks).orElse(List.of());
        return SummarySelector.paragraphs(sections, blocks);
    }

    /** AI 서버 요약 호출. 응답이 비어 있으면 AiServerException */
    private SummaryAiResponse requestSummaries(SummaryAiRequest request) {
        SummaryAiResponse response = aiServerClient.postJson(AiServerPaths.SUMMARIES, request,
                SummaryAiResponse.class);
        if (response == null || response.items() == null) {
            throw new AiServerException(null, "AI 서버 요약 응답이 비어 있어요.", null);
        }
        return response;
    }

    /**
     * 문장 변경 하나의 한 줄 풀이(3.11). 요약과 같은 /internal/summaries를 문장 항목 하나로 부르고, 요약과 같은 기준으로
     * 근거를 확인한다. 원문이 없는 변경({@link #explainable})은 부르지 않는다(호출하는 쪽이 먼저 거른다).
     *
     * @return 그 변경의 요약 한 줄(SHOWN이면 aiText가 풀이, REVIEW_NEEDED면 reviewReason이 사유)과 LLM 호출 기록
     * @throws AiServerException AI 서버·LLM을 쓸 수 없음
     */
    public TextExplanation explain(String companyName, String previousReport, String currentReport,
            TextChangeRow row, int changeNo) {
        List<SummaryAiRequest.Source> sources = SummaryResults.sources(row);
        if (!explainable(row)) {
            throw new IllegalStateException("원문이 없는 변경은 풀이를 만들지 않습니다: " + changeNo);
        }
        SummaryAiRequest.TextItem item = new SummaryAiRequest.TextItem(SummaryResults.TEXT_REF + changeNo, row.changeType(),
                row.sectionPath(), sources);
        SummaryAiResponse response = requestSummaries(new SummaryAiRequest(companyName, previousReport,
                currentReport, List.of(item), List.of(), List.of()));
        SummaryItemRow explained = SummaryResults.textRow(SummaryResults.answer(response, item.ref()), changeNo,
                SummaryResults.ids(sources), response, SummaryResults.time(response.generatedAt()));
        return new TextExplanation(explained, SummaryResults.calls(response));
    }

    /** 짝지은 원문(블록 번호와 글이 있는 쪽)이 하나라도 있어 풀이할 수 있는 변경인지. 검토 필요 유형은 풀이하지 않는다 */
    public static boolean explainable(TextChangeRow row) {
        return SummaryResults.explainable(row);
    }

    /** 문장 변경 하나의 풀이 결과와 그때의 LLM 호출 기록 */
    public record TextExplanation(SummaryItemRow row, List<LlmCallRow> calls) {
    }
}
