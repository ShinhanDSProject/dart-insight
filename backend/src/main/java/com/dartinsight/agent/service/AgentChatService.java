package com.dartinsight.agent.service;

import com.dartinsight.agent.config.AgentProperties;
import com.dartinsight.agent.domain.AgentActions;
import com.dartinsight.agent.domain.AgentStep;
import com.dartinsight.agent.domain.AskedQuestion;
import com.dartinsight.agent.domain.ChatStatus;
import com.dartinsight.agent.domain.Evidence;
import com.dartinsight.agent.domain.ToolLine;
import com.dartinsight.agent.domain.ToolLines;
import com.dartinsight.agent.dto.AgentStepAiRequest;
import com.dartinsight.agent.dto.AgentStepAiResponse;
import com.dartinsight.agent.dto.ChatMessageRequest;
import com.dartinsight.agent.dto.ChatMessageResponse;
import com.dartinsight.agent.repository.AgentCallStore;
import com.dartinsight.agent.service.ChatRequests.Checked;
import com.dartinsight.aiserver.client.AiServerClient;
import com.dartinsight.aiserver.client.AiServerException;
import com.dartinsight.aiserver.client.AiServerPaths;
import com.dartinsight.analysis.domain.Analysis;
import com.dartinsight.analysis.service.AnalysisResultService;
import com.dartinsight.common.trace.TraceContext;
import com.dartinsight.report.service.ReportService;
import com.dartinsight.report.service.ReportService.ReportDetail;
import com.dartinsight.summary.domain.LlmCallRow;
import com.dartinsight.summary.service.SummaryService;
import java.time.Clock;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * AI 에이전트 채팅(ADR-0044). Tool은 backend가 실행하고, ai-server는 한 번 부를 때마다 다음에 부를 Tool이나 최종 답
 * 하나를 정한다. 대화는 저장하지 않고, 한 채팅의 모든 왕복은 같은 추적 ID를 쓴다. 왕복 횟수·시간에 상한을 두고 넘으면
 * 검증하지 않은 부분 결과 없이 INCOMPLETE로 끝낸다. ai-server 호출은 트랜잭션 밖에서 하고 LLM 호출 기록만 저장한다(LY-2).
 */
@Service
@RequiredArgsConstructor
public class AgentChatService {

    private static final Logger log = LoggerFactory.getLogger(AgentChatService.class);
    private static final String CONTEXT_CALL = "ctx";

    private final AnalysisResultService resultService;
    private final ReportService reportService;
    private final AgentTools agentTools;
    private final AgentActionCheck actionCheck;
    private final AiServerClient aiServerClient;
    private final SummaryService summaryService;
    private final AgentCallStore callStore;
    private final AgentProperties properties;
    private final TransactionTemplate transactionTemplate;
    private final Clock clock;

    /**
     * 채팅 한 번. 완료된 분석에만 쓴다(없으면 404, 끝나지 않았으면 409).
     *
     * @throws AiServerException AI 서버·LLM을 쓸 수 없음(503 AI_SERVER_UNAVAILABLE)
     */
    public ChatMessageResponse chat(Long analysisId, ChatMessageRequest request) {
        Checked checked = ChatRequests.check(request);
        Analysis analysis = resultService.completed(analysisId);
        ReportDetail current = reportService.get(analysis.getCurrentRceptNo());
        ReportDetail previous = reportService.get(analysis.getPreviousRceptNo());
        Chat chat = new Chat(analysisId, checked, current, previous);
        try {
            return chat.run();
        } catch (AiServerException e) {
            chat.calls.addAll(summaryService.failedCalls(e));
            throw e;
        } finally {
            saveCalls(analysisId, chat.calls);
        }
    }

    private void saveCalls(long analysisId, List<LlmCallRow> calls) {
        if (!calls.isEmpty()) {
            transactionTemplate.executeWithoutResult(status -> callStore.save(analysisId, calls));
        }
    }

    /** 채팅 한 번의 상태: 지금까지의 Tool 결과, 근거 표, LLM 호출 기록 */
    private final class Chat {

        private final Long analysisId;
        private final Checked input;
        private final ReportDetail current;
        private final ReportDetail previous;
        private final List<AgentStepAiRequest.ToolResult> results = new ArrayList<>();
        private final Map<String, Evidence> evidence = new LinkedHashMap<>();
        private final List<LlmCallRow> calls = new ArrayList<>();
        /** 이 채팅에서 근거 질문 Tool이 저장한 질문(질문 ID → 질문). 응답의 questionId는 AskedQuestion.ratedBy로 고른다 */
        private final Map<Long, AskedQuestion> questions = new LinkedHashMap<>();
        /** LLM이 고른 Tool마다 그 결과의 근거 ID(화면 맥락으로 먼저 넣은 결과는 빼고). 조회 요청이었는지 가린다 */
        private final List<Set<String>> lookups = new ArrayList<>();
        private final String traceId = TraceContext.currentTraceId();

        private Chat(Long analysisId, Checked input, ReportDetail current, ReportDetail previous) {
            this.analysisId = analysisId;
            this.input = input;
            this.current = current;
            this.previous = previous;
        }

        private ChatMessageResponse run() {
            addSelected();
            long deadline = clock.millis() + properties.timeout().toMillis();
            for (int step = 0; step < properties.maxSteps(); step++) {
                if (clock.millis() >= deadline) {
                    break;
                }
                AgentStepAiResponse response = aiServerClient.postJson(AiServerPaths.AGENT_STEPS,
                        request(properties.maxSteps() - step - 1), AgentStepAiResponse.class);
                calls.addAll(ChatResults.calls(response, traceId));
                String type = response == null ? null : response.type();
                if (AgentStep.OUT_OF_SCOPE.equals(type)) {
                    return ChatResults.status(ChatStatus.OUT_OF_SCOPE, ChatResults.OUT_OF_SCOPE);
                }
                if (AgentStep.FINAL.equals(type) && response.finalAnswer() != null) {
                    return ChatResults.finalAnswer(response, evidence, reportNames(),
                            actionCheck.valid(analysisId, current.company().getCorpCode(), questions,
                                    response.finalAnswer().actions()), List.copyOf(questions.values()), lookups);
                }
                if (!AgentStep.TOOL_CALLS.equals(type) || response.toolCalls() == null
                        || response.toolCalls().isEmpty()) {
                    log.warn("AI 서버가 알 수 없는 에이전트 단계로 답해 검토 필요로 끝냅니다: {}", type);
                    return ChatResults.status(ChatStatus.REVIEW_NEEDED, ChatResults.NOT_VERIFIED);
                }
                response.toolCalls().forEach(call -> execute(call.callId(), call.name(), call.arguments()));
            }
            log.info("에이전트 채팅이 상한(왕복 {}회·{})을 넘어 끝냅니다", properties.maxSteps(), properties.timeout());
            return ChatResults.status(ChatStatus.INCOMPLETE, ChatResults.INCOMPLETE);
        }

        /** 화면에서 고른 변경을 첫 왕복 전에 Tool 결과로 넣는다. 이 분석에 없으면 뺀다 */
        private void addSelected() {
            ChatMessageRequest.Context context = input.context();
            if (context == null) {
                return;
            }
            if (context.textChangeId() != null) {
                AgentTools.Run run = agentTools.run(AgentTools.GET_TEXT_CHANGE, analysisId,
                        Map.of("changeId", context.textChangeId()), properties.maxItems(),
                        properties.maxResultChars());
                if (run.ok()) {
                    add(CONTEXT_CALL + "-text", AgentTools.GET_TEXT_CHANGE, Map.of("changeId",
                            context.textChangeId()), run);
                }
            }
            if (context.financialChangeId() != null) {
                agentTools.selectedFinancialChange(analysisId, context.financialChangeId()).ifPresent(line -> add(
                        CONTEXT_CALL + "-financial", AgentTools.GET_FINANCIAL_CHANGES,
                        Map.of("changeId", context.financialChangeId()),
                        new AgentTools.Run(true, null, new ToolLines.Limited(List.of(line), false), null)));
            }
        }

        private void execute(String callId, String name, Map<String, Object> arguments) {
            AgentTools.Run run = agentTools.run(name, analysisId, arguments, properties.maxItems(),
                    properties.maxResultChars());
            lookups.add(run.lines().lines().stream().map(ToolLine::evidenceId).filter(Objects::nonNull)
                    .collect(Collectors.toSet()));
            add(callId, name, arguments == null ? Map.of() : arguments, run);
        }

        private void add(String callId, String name, Map<String, Object> arguments, AgentTools.Run run) {
            if (run.question() != null) {
                questions.put(run.question().id(), run.question());
            }
            List<AgentStepAiRequest.Item> items = new ArrayList<>();
            for (ToolLine line : run.lines().lines()) {
                if (line.evidence() != null) {
                    evidence.merge(line.evidenceId(), line.evidence(), Evidence::fill);
                }
                items.add(new AgentStepAiRequest.Item(line.evidenceId(), line.text(), line.grade()));
            }
            results.add(new AgentStepAiRequest.ToolResult(callId, name, arguments, run.ok(), run.error(),
                    run.lines().truncated(), items));
        }

        private AgentStepAiRequest request(int remainingSteps) {
            List<AgentStepAiRequest.Turn> history = input.history().stream()
                    .map(t -> new AgentStepAiRequest.Turn(t.role(), t.text())).toList();
            List<AgentStepAiRequest.Tool> tools = agentTools.all().stream()
                    .map(t -> new AgentStepAiRequest.Tool(t.name(), t.description(), t.parameters())).toList();
            List<AgentStepAiRequest.Action> actions = AgentActions.SPECS.entrySet().stream()
                    .map(e -> new AgentStepAiRequest.Action(e.getKey(), e.getValue())).toList();
            return new AgentStepAiRequest(current.company().getCorpName(), previous.report().getReportName(),
                    current.report().getReportName(), input.message(), history, screen(), tools, actions,
                    List.copyOf(results), remainingSteps);
        }

        /** 화면 맥락. 고른 변경의 내용은 Tool 결과로 따로 보낸다 */
        private Map<String, Object> screen() {
            Map<String, Object> screen = new LinkedHashMap<>();
            ChatMessageRequest.Context context = input.context();
            if (context != null) {
                screen.put("tab", context.tab());
                screen.put("side", context.side());
                screen.put("sectionNo", context.sectionNo());
            }
            screen.values().removeIf(v -> v == null);
            return screen;
        }

        private Map<String, String> reportNames() {
            return Map.of(current.report().getRceptNo(), current.report().getReportName(),
                    previous.report().getRceptNo(), previous.report().getReportName());
        }
    }
}
