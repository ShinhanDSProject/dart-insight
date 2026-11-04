package com.dartinsight.agent.service;

import static com.dartinsight.agent.domain.Schemas.bool;
import static com.dartinsight.agent.domain.Schemas.integer;
import static com.dartinsight.agent.domain.Schemas.object;
import static com.dartinsight.agent.domain.Schemas.oneOf;
import static com.dartinsight.agent.domain.Schemas.properties;
import static com.dartinsight.agent.domain.Schemas.string;

import com.dartinsight.agent.domain.AgentActions;
import com.dartinsight.agent.domain.AskedQuestion;
import com.dartinsight.agent.domain.Evidence;
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
import com.dartinsight.document.domain.EvidenceRef;
import com.dartinsight.document.service.DocumentService;
import com.dartinsight.explanation.domain.ExplanationStatus;
import com.dartinsight.explanation.dto.TextExplanationResponse;
import com.dartinsight.explanation.service.ExplanationService;
import com.dartinsight.question.domain.QuestionStatus;
import com.dartinsight.question.dto.QuestionResponse;
import com.dartinsight.question.service.QuestionService;
import com.dartinsight.relateddisclosure.domain.ChangeRelatedDisclosures;
import com.dartinsight.relateddisclosure.service.RelatedDisclosureService;
import com.dartinsight.report.domain.DartLinks;
import com.dartinsight.summary.domain.SummaryItemRow;
import com.dartinsight.summary.service.SummaryQueryService;
import com.dartinsight.summary.service.SummaryQueryService.StoredSummary;
import com.dartinsight.summary.service.SummaryQueryService.SummaryEntry;
import com.dartinsight.question.domain.QuestionFacts;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;
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
    static final String ANSWER_WITH_EVIDENCE = "answer_with_evidence";
    static final String GET_SUMMARY = "get_summary";
    static final String EXPLAIN_TEXT_CHANGE = "explain_text_change";
    static final String FIND_RELATED_DISCLOSURES = "find_related_disclosures";

    static final int MAX_SIZE = 10;
    /** 목차는 최상위 항목마다 한 줄이라 일반 결과보다 줄 수를 넉넉히 둔다(사업보고서 최상위 항목 12개 안팎) */
    static final int OUTLINE_ITEMS = 30;
    private static final List<String> STATEMENTS = List.of("BS", "IS", "CIS", "CF", "SCE");

    private final TextChangeQueryService textChangeQueryService;
    private final TextEvidenceService textEvidenceService;
    private final FinancialChangeQueryService financialChangeQueryService;
    private final SourceDocumentService sourceDocumentService;
    private final QuestionService questionService;
    private final SummaryQueryService summaryQueryService;
    private final ExplanationService explanationService;
    private final RelatedDisclosureService relatedDisclosureService;
    private final DocumentService documentService;

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
        Output run(Long analysisId, ToolArgs args);
    }

    /**
     * Tool 하나가 만든 줄과, 근거 질문 Tool이면 그때 저장한 질문.
     *
     * @param question 근거 질문 Tool이 저장한 질문. 그 밖의 Tool은 null
     */
    record Output(List<ToolLine> lines, AskedQuestion question) {

        static Output of(List<ToolLine> lines) {
            return new Output(lines, null);
        }
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
                        "size", integer("고를 수", 1, MAX_SIZE)), List.of()), 0, (a, args) -> Output.of(searchTextChanges(a, args))),
                new Tool(GET_TEXT_CHANGE, "문장 변경 하나의 이전·현재 원문 문단", object(properties(
                        "changeId", integer("문장 변경 ID")), List.of("changeId")), 0, (a, args) -> Output.of(textChange(a, args))),
                new Tool(GET_FINANCIAL_CHANGES, "이 분석의 재무 계정 변화(코드가 계산한 이전·현재 값과 증감)", object(
                        properties(
                                "sjDiv", oneOf("재무제표. BS 재무상태표, IS 손익계산서, CIS 포괄손익계산서, CF 현금흐름표, "
                                        + "SCE 자본변동표", STATEMENTS),
                                "q", string("계정 이름에서 찾을 글(예: 영업이익)"),
                                "size", integer("고를 수", 1, MAX_SIZE)), List.of()), 0, (a, args) -> Output.of(financialChanges(a, args))),
                new Tool(GET_DOCUMENT_OUTLINE, "한쪽 보고서 원문의 목차(최상위 항목과 하위 항목 번호)", object(properties(
                        "side", oneOf("previous 이전 보고서, current 현재 보고서", AgentActions.SIDES)),
                        List.of("side")), OUTLINE_ITEMS, (a, args) -> Output.of(outline(a, args))),
                new Tool(GET_DOCUMENT_SECTION, "원문 한 항목의 문단·표", object(properties(
                        "side", oneOf("previous 이전 보고서, current 현재 보고서", AgentActions.SIDES),
                        "sectionNo", integer("목차의 항목 번호")), List.of("side", "sectionNo")), 0,
                        (a, args) -> Output.of(section(a, args))),
                new Tool(ANSWER_WITH_EVIDENCE, "두 보고서 원문과 계산한 재무 사실로 질문에 근거를 들어 답한다(기존 AI 질문과 "
                        + "같은 검사, 질문은 저장됨). 변화의 이유·설명을 물을 때 쓴다", object(properties(
                        "question", string("묻는 내용만 짧게(2~200자). 회사·보고서·기간 이름과 '원문 근거와 함께' 같은 "
                                + "근거 요청 말은 붙이지 않는다(이 분석의 두 보고서에서 찾음)")), List.of("question")), 0,
                        this::answer),
                new Tool(GET_SUMMARY, "저장된 요약·설명(재무 설명 등급 STATED·RELATED·NONE과 인용 포함). 새로 만들지 않는다",
                        object(properties(), List.of()), 0, (a, args) -> Output.of(summary(a))),
                new Tool(EXPLAIN_TEXT_CHANGE, "문장 변경 하나의 AI 한 줄 풀이(저장된 풀이가 있으면 그것)", object(properties(
                        "changeId", integer("문장 변경 ID")), List.of("changeId")), 0,
                        (a, args) -> Output.of(explanation(a, args))),
                new Tool(FIND_RELATED_DISCLOSURES, "문장 변경 하나와 관련된 수시공시(보조 근거)", object(properties(
                        "changeId", integer("문장 변경 ID")), List.of("changeId")), 0,
                        (a, args) -> Output.of(relatedDisclosures(a, args))));
    }

    Optional<Tool> find(String name) {
        return all().stream().filter(t -> t.name().equals(name)).findFirst();
    }

    /**
     * Tool 하나를 실행한 결과. 실행하지 못했으면 ok가 false이고 error에 짧은 사유가 있다.
     *
     * @param lines 정해진 크기로 줄인 결과
     */
    record Run(boolean ok, String error, ToolLines.Limited lines, AskedQuestion question) {

        static Run failed(String error) {
            return new Run(false, error, new ToolLines.Limited(List.of(), false), null);
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
            Output output = tool.get().executor().run(analysisId, args);
            int items = tool.get().maxItems() > 0 ? tool.get().maxItems() : maxItems;
            return new Run(true, null, ToolLines.limit(output.lines(), items, maxChars), output.question());
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

    /** 기존 근거 질문(ADR-0023): 같은 검사로 답하고 analysis_question에 저장한다. 답·인용·사실을 줄로 넘긴다 */
    private Output answer(Long analysisId, ToolArgs args) {
        String question = args.string("question");
        if (question == null) {
            throw new IllegalArgumentException("question이 없습니다.");
        }
        QuestionResponse response = questionService.ask(analysisId, question);
        List<ToolLine> lines = new ArrayList<>();
        lines.add(new ToolLine(null, "[질문 ID " + response.questionId() + ", " + response.status() + "] "
                + (response.answer() != null ? response.answer() : String.valueOf(response.message()))));
        for (QuestionResponse.Citation c : response.citations()) {
            lines.add(new ToolLine(Evidence.block(c.evidenceId(), c.side(), c.rceptNo(), c.sectionNo(), c.blockNo(),
                    c.sectionPath(), c.quote()), "[인용 " + c.no() + ", 질문 ID " + response.questionId() + "] "
                    + c.sectionPath() + ": " + c.quote()));
        }
        for (QuestionResponse.Fact f : response.facts()) {
            lines.add(new ToolLine(Evidence.financialChange(f.changeId(), f.sjDiv(), f.accountName(), null,
                    f.sentence()), "[" + f.sjDiv() + ", changeId " + f.changeId() + "] " + f.sentence()));
        }
        Set<String> evidenceIds = lines.stream().map(ToolLine::evidenceId).filter(Objects::nonNull)
                .collect(Collectors.toSet());
        return new Output(lines, new AskedQuestion(response.questionId(), response.citations().size(),
                response.status() == QuestionStatus.ANSWERED, evidenceIds));
    }

    /** 저장된 요약만(새로 만들지 않음). 재무 설명 등급과 인용을 그대로 넘긴다(ADR-0015) */
    private List<ToolLine> summary(Long analysisId) {
        StoredSummary stored = summaryQueryService.summary(analysisId);
        List<ToolLine> lines = new ArrayList<>();
        for (SummaryEntry entry : stored.entries()) {
            SummaryItemRow row = entry.row();
            if (!SummaryItemRow.SHOWN.equals(row.status()) || entry.changeId() == null) {
                continue;
            }
            if (SummaryItemRow.FINANCIAL.equals(row.kind())) {
                String grade = row.explanationGrade();
                String text = "[요약 재무, changeId " + entry.changeId() + ", 등급 " + (grade == null ? "없음" : grade)
                        + "] " + row.factSentence() + (row.aiText() == null ? "" : " / 설명: " + row.aiText());
                lines.add(new ToolLine(Evidence.financialChange(entry.changeId(), entry.sjDiv(), null,
                        stored.analysis().getCurrentRceptNo(), row.factSentence()).withGrade(grade), text));
                // 인용 위치가 원문 블록 ID({접수번호}#B{번호})가 아니면 인용을 넘기지 않는다
                if (row.quote() != null && row.quoteEvidenceId() != null
                        && EvidenceRef.parse(row.quoteEvidenceId()).blockNo() != null) {
                    lines.add(quoteLine(stored.analysis().getCurrentRceptNo(), row, grade));
                }
            } else if (row.aiText() != null) {
                // AI 문장은 원문 미리보기(quote)에 넣지 않는다
                lines.add(new ToolLine(Evidence.textChange(entry.changeId(), null, null, null, null),
                        "[요약 문장 변화, changeId " + entry.changeId() + "] " + row.aiText()));
            }
        }
        if (lines.isEmpty()) {
            lines.add(new ToolLine(null, "이 분석에 저장된 요약 항목이 없어요."));
        }
        return lines;
    }

    /**
     * 요약 인용 한 줄. 근거 ID로 저장된 원문의 문단을 찾아 항목 번호·섹션 경로를 붙인다(근거 칩으로 원문을 열 수 있게).
     * 원문에서 찾지 못하면 위치 없이 인용만 둔다.
     */
    private ToolLine quoteLine(String currentRceptNo, SummaryItemRow row, String grade) {
        EvidenceRef ref = EvidenceRef.parse(row.quoteEvidenceId());
        String side = ref.rceptNo().equals(currentRceptNo) ? "current" : "previous";
        Evidence evidence = documentService.find(ref.rceptNo())
                .flatMap(document -> documentService.block(document, ref.blockNo()).map(block -> Evidence.block(
                        block.evidenceId(), side, block.rceptNo(), block.sectionNo(), block.blockNo(),
                        TextEvidenceService.paths(documentService.sections(document)).get(block.sectionNo()),
                        row.quote())))
                .orElseGet(() -> new Evidence(row.quoteEvidenceId(), Evidence.Kind.BLOCK, side, ref.rceptNo(), null,
                        null, null, null, null, null, row.quote(), null, null, null, null, null, null))
                .withGrade(grade);
        return new ToolLine(evidence, "[요약 인용, 등급 " + grade + "] " + row.quote());
    }

    /** 문장 변경 한 줄 풀이(저장된 풀이 우선). 풀이가 없거나 검토 필요면 그 사유만 넘긴다 */
    private List<ToolLine> explanation(Long analysisId, ToolArgs args) {
        long changeId = args.requiredId("changeId");
        TextExplanationResponse response = explanationService.explain(analysisId, changeId);
        if (response.status() != ExplanationStatus.OK || response.sentence() == null) {
            return List.of(new ToolLine(null, "[풀이 " + response.status() + "] " + response.message()));
        }
        List<ToolLine> lines = new ArrayList<>();
        lines.add(new ToolLine(Evidence.textChange(changeId, null, null, null, null),
                "[AI 한 줄 풀이, changeId " + changeId + "] " + response.sentence()));
        for (TextExplanationResponse.Evidence e : response.evidence()) {
            if (e.sectionNo() != null && e.blockNo() != null) {
                lines.add(new ToolLine(Evidence.block(e.evidenceId(), e.side(), e.rceptNo(), e.sectionNo(),
                        e.blockNo(), e.sectionPath(), null), "[풀이 근거 위치] " + e.sectionPath()));
            }
        }
        return lines;
    }

    /** 문장 변경과 관련된 수시공시(보조 근거, ADR-0030). 공시 본문은 비교하지 않고 제목·접수일만 넘긴다 */
    private List<ToolLine> relatedDisclosures(Long analysisId, ToolArgs args) {
        ChangeRelatedDisclosures related = relatedDisclosureService.forChange(analysisId, args.requiredId("changeId"));
        if (related.links().isEmpty()) {
            return List.of(new ToolLine(null, "관련 수시공시를 찾지 못했어요(" + related.status() + ")."));
        }
        return related.links().stream().map(link -> {
            var d = link.disclosure();
            String rceptDt = d.rceptDt() == null ? null : d.rceptDt().toString();
            return new ToolLine(Evidence.disclosure(d.rceptNo(), d.reportName(), rceptDt,
                    DartLinks.viewer(d.rceptNo())), "[수시공시 " + rceptDt + ", " + link.matchLevel() + "] "
                    + d.reportName());
        }).toList();
    }

    private static Optional<ToolLine> changeBlock(String side, SourceEvidence source) {
        return source == null ? Optional.empty() : ToolTexts.changeBlock(side, source.side(), source.sectionPath());
    }
}
