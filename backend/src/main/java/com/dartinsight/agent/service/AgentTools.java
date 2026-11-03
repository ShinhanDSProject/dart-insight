package com.dartinsight.agent.service;

import static com.dartinsight.agent.domain.Schemas.bool;
import static com.dartinsight.agent.domain.Schemas.integer;
import static com.dartinsight.agent.domain.Schemas.object;
import static com.dartinsight.agent.domain.Schemas.oneOf;
import static com.dartinsight.agent.domain.Schemas.properties;
import static com.dartinsight.agent.domain.Schemas.string;

import com.dartinsight.agent.domain.AgentActions;
import com.dartinsight.agent.domain.ToolArgs;
import com.dartinsight.agent.domain.ToolLine;
import com.dartinsight.agent.domain.ToolLines;
import com.dartinsight.agent.domain.ToolTexts;
import com.dartinsight.analysis.domain.TextChangeFilter;
import com.dartinsight.analysis.service.FinancialChangeQueryService;
import com.dartinsight.analysis.service.SourceDocumentService;
import com.dartinsight.analysis.service.SourceDocumentService.SourceOutline;
import com.dartinsight.analysis.service.SourceDocumentService.SourceSection;
import com.dartinsight.analysis.service.TextChangeQueryService;
import com.dartinsight.analysis.service.TextChangeQueryService.TextChangePage;
import com.dartinsight.analysis.service.TextEvidenceService;
import com.dartinsight.analysis.service.TextEvidenceService.SourceEvidence;
import com.dartinsight.analysis.service.TextEvidenceService.TextEvidence;
import com.dartinsight.common.error.ApiException;
import com.dartinsight.question.domain.QuestionFacts;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * 에이전트 채팅의 Tool 목록(ADR-0044). Tool은 여기 한 곳에만 두고, ai-server에는 이름·설명·인자 스키마를 요청마다 보낸다.
 * 모두 읽기이고 기존 서비스 메서드를 부른다(자기 HTTP API나 채팅 API를 다시 부르지 않음). 쓰기는 Tool이 아니라
 * 확인 액션으로 돌려준다(#578).
 */
@Component
@RequiredArgsConstructor
public class AgentTools {

    static final String SEARCH_TEXT_CHANGES = "search_text_changes";
    static final String GET_TEXT_CHANGE = "get_text_change";
    static final String GET_FINANCIAL_CHANGES = "get_financial_changes";
    static final String GET_DOCUMENT_OUTLINE = "get_document_outline";
    static final String GET_DOCUMENT_SECTION = "get_document_section";

    static final int MAX_SIZE = 10;
    /** 목차는 최상위 항목마다 한 줄이라 일반 결과보다 줄 수를 넉넉히 둔다(사업보고서 최상위 항목 12개 안팎) */
    static final int OUTLINE_ITEMS = 30;
    private static final List<String> STATEMENTS = List.of("BS", "IS", "CIS", "CF", "SCE");

    private final TextChangeQueryService textChangeQueryService;
    private final TextEvidenceService textEvidenceService;
    private final FinancialChangeQueryService financialChangeQueryService;
    private final SourceDocumentService sourceDocumentService;

    /**
     * Tool 하나.
     *
     * @param parameters 인자의 JSON Schema(object). 받는 인자 이름도 여기서 정한다
     * @param maxItems   결과 줄 수 상한. 0이면 설정값(app.agent.max-items)
     */
    record Tool(String name, String description, Map<String, Object> parameters, int maxItems, Executor executor) {

        @SuppressWarnings("unchecked")
        Set<String> argumentNames() {
            return ((Map<String, Object>) parameters.get("properties")).keySet();
        }
    }

    @FunctionalInterface
    interface Executor {
        List<ToolLine> run(Long analysisId, ToolArgs args);
    }

    /** 이 채팅에서 쓸 수 있는 Tool(ai-server에 보내는 순서) */
    List<Tool> all() {
        return List.of(
                new Tool(SEARCH_TEXT_CHANGES, "이 분석의 문장·표 변경을 유형·섹션·검색어·위험 관련으로 거르고 확인 우선순위나 "
                        + "문서 순서로 고른다", object(properties(
                        "type", string("변경 유형. ADDED·DELETED·MODIFIED·NUMERIC_UPDATE·MOVED·REVIEW_NEEDED를 쉼표로"),
                        "section", string("최상위 섹션 제목(예: II. 사업의 내용)"),
                        "q", string("변경 전·후 글이나 섹션 경로에서 찾을 글(2~100자)"),
                        "risk", bool("위험 관련 목차(위험·우발·소송·제재 등)의 변경만"),
                        "sort", oneOf("priority 확인 우선순위(기본), document 문서 순서", AgentActions.SORTS),
                        "size", integer("고를 수", 1, MAX_SIZE)), List.of()), 0, this::searchTextChanges),
                new Tool(GET_TEXT_CHANGE, "문장 변경 하나의 이전·현재 원문 문단", object(properties(
                        "changeId", integer("문장 변경 ID")), List.of("changeId")), 0, this::textChange),
                new Tool(GET_FINANCIAL_CHANGES, "이 분석의 재무 계정 변화(코드가 계산한 이전·현재 값과 증감)", object(
                        properties(
                                "sjDiv", oneOf("재무제표. BS 재무상태표, IS 손익계산서, CIS 포괄손익계산서, CF 현금흐름표, "
                                        + "SCE 자본변동표", STATEMENTS),
                                "q", string("계정 이름에서 찾을 글(예: 영업이익)"),
                                "size", integer("고를 수", 1, MAX_SIZE)), List.of()), 0, this::financialChanges),
                new Tool(GET_DOCUMENT_OUTLINE, "한쪽 보고서 원문의 목차(최상위 항목과 하위 항목 번호)", object(properties(
                        "side", oneOf("previous 이전 보고서, current 현재 보고서", AgentActions.SIDES)),
                        List.of("side")), OUTLINE_ITEMS, this::outline),
                new Tool(GET_DOCUMENT_SECTION, "원문 한 항목의 문단·표", object(properties(
                        "side", oneOf("previous 이전 보고서, current 현재 보고서", AgentActions.SIDES),
                        "sectionNo", integer("목차의 항목 번호")), List.of("side", "sectionNo")), 0, this::section));
    }

    Optional<Tool> find(String name) {
        return all().stream().filter(t -> t.name().equals(name)).findFirst();
    }

    /**
     * Tool 하나를 실행한 결과. 실행하지 못했으면 ok가 false이고 error에 짧은 사유가 있다.
     *
     * @param lines 정해진 크기로 줄인 결과
     */
    record Run(boolean ok, String error, ToolLines.Limited lines) {

        static Run failed(String error) {
            return new Run(false, error, new ToolLines.Limited(List.of(), false));
        }
    }

    /**
     * 목록에 없는 Tool, 형식이 맞지 않는 인자, 이 분석에 없는 ID는 실행하지 않고 실패한 결과로 돌려준다(ADR-0044).
     * 그 밖의 오류(서버 오류)는 그대로 던진다.
     */
    Run run(String name, Long analysisId, Map<String, Object> arguments, int maxItems, int maxChars) {
        Optional<Tool> tool = find(name);
        if (tool.isEmpty()) {
            return Run.failed("주어진 Tool이 아닙니다: " + name);
        }
        try {
            ToolArgs args = ToolArgs.of(arguments, tool.get().argumentNames());
            List<ToolLine> lines = tool.get().executor().run(analysisId, args);
            int items = tool.get().maxItems() > 0 ? tool.get().maxItems() : maxItems;
            return new Run(true, null, ToolLines.limit(lines, items, maxChars));
        } catch (IllegalArgumentException e) {
            return Run.failed(e.getMessage());
        } catch (ApiException e) {
            if (e.errorCode().status() >= 500) {
                throw e;
            }
            return Run.failed(e.getMessage());
        }
    }

    /** 화면에서 고른 재무 계정 변화 한 줄. 이 분석에 없으면 빈 값 */
    Optional<ToolLine> selectedFinancialChange(Long analysisId, long changeId) {
        return financialChangeQueryService.changes(analysisId).changes().stream()
                .filter(c -> c.getId() == changeId && QuestionFacts.hasFact(c))
                .findFirst().map(ToolTexts::financialChange);
    }

    private List<ToolLine> searchTextChanges(Long analysisId, ToolArgs args) {
        List<String> types = ToolTexts.types(args.string("type"));
        String q = args.string("q");
        if (q != null && (q.length() < 2 || q.length() > 100)) {
            throw new IllegalArgumentException("q는 2~100자여야 합니다.");
        }
        boolean byPriority = "priority".equals(args.choice("sort", AgentActions.SORTS, "priority"));
        TextChangePage page = textChangeQueryService.page(analysisId,
                new TextChangeFilter(types, args.string("section"), q, args.flag("risk")), byPriority, 0,
                args.integer("size", 1, MAX_SIZE, MAX_SIZE));
        return page.changes().stream().map(ToolTexts::textChange).toList();
    }

    private List<ToolLine> textChange(Long analysisId, ToolArgs args) {
        TextEvidence evidence = textEvidenceService.evidence(analysisId, args.requiredId("changeId"));
        List<ToolLine> lines = new ArrayList<>(List.of(ToolTexts.textChange(evidence.change())));
        changeBlock("previous", evidence.previous()).ifPresent(lines::add);
        changeBlock("current", evidence.current()).ifPresent(lines::add);
        return lines;
    }

    private List<ToolLine> financialChanges(Long analysisId, ToolArgs args) {
        String sjDiv = args.choice("sjDiv", STATEMENTS, null);
        String q = args.string("q");
        int size = args.integer("size", 1, MAX_SIZE, MAX_SIZE);
        return financialChangeQueryService.changes(analysisId).changes().stream()
                .filter(QuestionFacts::hasFact)
                .filter(c -> sjDiv == null || sjDiv.equals(c.getSjDiv()))
                .filter(c -> ToolTexts.accountMatches(c, q))
                .limit(size)
                .map(ToolTexts::financialChange)
                .toList();
    }

    private List<ToolLine> outline(Long analysisId, ToolArgs args) {
        String side = args.requiredChoice("side", AgentActions.SIDES);
        SourceOutline outline = sourceDocumentService.outline(analysisId, side);
        if (outline.document().isEmpty()) {
            return List.of(new ToolLine(null, "이 보고서의 원문을 아직 받지 않았어요."));
        }
        return ToolTexts.outline(side, outline.report().getRceptNo(), outline.sections());
    }

    private List<ToolLine> section(Long analysisId, ToolArgs args) {
        String side = args.requiredChoice("side", AgentActions.SIDES);
        SourceSection section = sourceDocumentService.section(analysisId, side,
                (int) args.requiredId("sectionNo"));
        return section.blocks().stream()
                .filter(b -> b.text() != null && !b.text().isBlank())
                .map(b -> ToolTexts.block(side, b, section.sectionPath()))
                .toList();
    }

    private static Optional<ToolLine> changeBlock(String side, SourceEvidence source) {
        return source == null ? Optional.empty() : ToolTexts.changeBlock(side, source.side(), source.sectionPath());
    }
}
