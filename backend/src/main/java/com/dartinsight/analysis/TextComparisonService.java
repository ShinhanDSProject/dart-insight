package com.dartinsight.analysis;

import com.dartinsight.aiserver.AiServerClient;
import com.dartinsight.aiserver.AiServerPaths;
import com.dartinsight.analysis.TextChangeRow.Side;
import com.dartinsight.document.DocumentBlock;
import com.dartinsight.document.DocumentService;
import com.dartinsight.document.DocumentStatus;
import com.dartinsight.document.ReportDocument;
import com.dartinsight.report.Report;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * 문장·표 변경 탐지(2.5)와 확인 우선순위(2.6). 두 보고서 원문을 구조화(4.2)한 뒤 AI 서버에 비교를 맡기고,
 * 돌려받은 위치에 저장된 원문 글을 붙인다.
 * 원문을 받지 못하거나 읽지 못하면 예외를 던지지 않고 FAILED와 사유를 돌려준다(분석은 재무 결과로 완료).
 * 일부만 읽은 원문(PARTIAL)으로 비교했으면 PARTIAL로 남겨 완전한 결과처럼 보이지 않게 한다.
 */
@Service
@RequiredArgsConstructor
public class TextComparisonService {

    private static final Logger log = LoggerFactory.getLogger(TextComparisonService.class);

    private final DocumentService documentService;
    private final AiServerClient aiServerClient;

    public TextComparison compare(Report previous, Report current) {
        ReportDocument previousDocument;
        ReportDocument currentDocument;
        try {
            previousDocument = documentService.ensureStructured(previous);
            currentDocument = documentService.ensureStructured(current);
        } catch (RuntimeException e) {
            log.warn("원문 구조화 실패 {} / {}", previous.getRceptNo(), current.getRceptNo(), e);
            return TextComparison.failed("원문을 받거나 읽지 못해 문장을 비교하지 못했어요. 다시 요청해 주세요. ("
                    + e.getMessage() + ")");
        }
        String problem = unusable("이전", previousDocument);
        if (problem == null) {
            problem = unusable("현재", currentDocument);
        }
        if (problem != null) {
            return TextComparison.failed(problem);
        }

        List<DocumentBlock> previousBlocks = documentService.blocks(previousDocument);
        List<DocumentBlock> currentBlocks = documentService.blocks(currentDocument);
        TextChangeRequest request = new TextChangeRequest(
                document(previousDocument, previousBlocks), document(currentDocument, currentBlocks));
        TextChangeDiffResponse diff;
        try {
            diff = aiServerClient.postJson(AiServerPaths.TEXT_CHANGES, request, TextChangeDiffResponse.class);
        } catch (RuntimeException e) {
            log.warn("문장 비교 실패 {} / {}", previous.getRceptNo(), current.getRceptNo(), e);
            return TextComparison.failed("AI 서버가 응답하지 않아 문장을 비교하지 못했어요. 다시 요청해 주세요.");
        }
        if (diff == null || diff.changes() == null) {
            return TextComparison.failed("문장 비교 결과를 받지 못했어요. 다시 요청해 주세요.");
        }

        Map<Integer, DocumentBlock> previousByNo = byNo(previousBlocks);
        Map<Integer, DocumentBlock> currentByNo = byNo(currentBlocks);
        List<TextChangeRow> rows = new ArrayList<>(diff.changes().size());
        try {
            for (TextChangeDiffResponse.Change change : diff.changes()) {
                rows.add(new TextChangeRow(change.changeType(), change.blockType(),
                        Boolean.TRUE.equals(change.numbersOnly()), change.sectionStatus(), change.sectionTitle(),
                        change.sectionPath(), side(previous.getRceptNo(), change.previous(), previousByNo),
                        side(current.getRceptNo(), change.current(), currentByNo),
                        TextChangeStore.similarity(change.similarity()), change.reviewReason(),
                        priority(change.priority(), diff.priorityVersion())));
            }
        } catch (RuntimeException e) {
            // 받은 결과를 읽지 못해도 분석 전체를 실패로 만들지 않는다(문장 비교만 실패)
            log.warn("문장 비교 결과를 읽지 못함 {} / {}", previous.getRceptNo(), current.getRceptNo(), e);
            return TextComparison.failed("문장 비교 결과를 읽지 못했어요. 다시 요청해 주세요.");
        }
        log.info("문장 비교 {} → {}: 변경 {}건, 섹션 {}", previous.getRceptNo(), current.getRceptNo(), rows.size(),
                diff.sectionCounts());

        String partial = partial("이전", previousDocument);
        if (partial == null) {
            partial = partial("현재", currentDocument);
        }
        return new TextComparison(partial == null ? TextStatus.COMPLETED : TextStatus.PARTIAL, partial, rows);
    }

    private static String unusable(String side, ReportDocument document) {
        return switch (document.getStatus()) {
            case NOT_AVAILABLE -> side + " 보고서 원문이 OpenDART에 없어 문장을 비교하지 못했어요.";
            case FAILED -> side + " 보고서 원문을 읽지 못해 문장을 비교하지 못했어요."
                    + (document.getFailureMessage() == null ? "" : " (" + document.getFailureMessage() + ")");
            case STRUCTURED, PARTIAL -> null;
        };
    }

    private static String partial(String side, ReportDocument document) {
        return document.getStatus() == DocumentStatus.PARTIAL
                ? side + " 보고서 원문 일부를 읽지 못했을 수 있어 문장 비교가 완전하지 않을 수 있어요." : null;
    }

    private TextChangeRequest.Document document(ReportDocument document, List<DocumentBlock> blocks) {
        return new TextChangeRequest.Document(document.getRceptNo(),
                documentService.sections(document).stream()
                        .map(s -> new TextChangeRequest.Section(s.sectionNo(), s.parentNo(), s.depth(), s.title(),
                                s.cover()))
                        .toList(),
                blocks.stream()
                        .map(b -> new TextChangeRequest.Block(b.blockNo(), b.sectionNo(), b.type(), b.text()))
                        .toList());
    }

    private static Map<Integer, DocumentBlock> byNo(List<DocumentBlock> blocks) {
        return blocks.stream().collect(Collectors.toMap(DocumentBlock::blockNo, Function.identity(), (a, b) -> a));
    }

    private static TextChangeRow.Priority priority(TextChangeDiffResponse.PriorityResult result, String version) {
        if (result == null || result.level() == null) {
            return null;
        }
        return new TextChangeRow.Priority(result.level(), result.score(),
                result.reasons() == null ? List.of() : result.reasons(), version);
    }

    /** 위치가 가리키는 원문 글을 붙인다. 블록이 없으면 글이 null이고, 근거 확인 단계에서 걸러진다. */
    private static Side side(String rceptNo, TextChangeDiffResponse.Position position,
            Map<Integer, DocumentBlock> blocks) {
        if (position == null || position.sectionNo() == null) {
            return null;
        }
        Integer blockNo = position.blockNo();
        DocumentBlock block = blockNo == null ? null : blocks.get(blockNo);
        if (block != null && block.sectionNo() != position.sectionNo()) {
            block = null;
        }
        return new Side(rceptNo, position.sectionNo(), blockNo, block == null ? null : block.text());
    }
}
