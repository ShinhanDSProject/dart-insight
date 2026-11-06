package com.dartinsight.agent.domain;

import com.dartinsight.analysis.domain.FinancialChange;
import com.dartinsight.analysis.domain.TextChange;
import com.dartinsight.analysis.domain.TextChangeFilter;
import com.dartinsight.analysis.domain.TextChangeRow;
import com.dartinsight.document.domain.DocumentBlock;
import com.dartinsight.document.domain.DocumentSection;
import com.dartinsight.question.domain.QuestionFacts;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Tool 결과의 줄 만들기(저장된 자료 → ai-server에 보낼 글과 근거 위치). 숫자는 저장된 계산 결과의 사실 문장
 * (QuestionFacts)을 그대로 쓴다. 줄 글에 changeId·항목 번호를 넣어 LLM이 다음 Tool·화면 액션 값으로 쓰게 한다.
 */
public final class ToolTexts {

    static final int LINE_CHARS = 400;

    private ToolTexts() {
    }

    /** 요청의 type(쉼표로 이은 유형). 모르는 유형이면 실패 */
    public static List<String> types(String value) {
        if (value == null) {
            return List.of();
        }
        List<String> types = Arrays.stream(value.split(TextChangeFilter.TYPE_SEPARATOR)).map(String::strip)
                .filter(t -> !t.isEmpty()).distinct().toList();
        for (String type : types) {
            if (!TextChangeRow.TYPES.contains(type)) {
                throw new IllegalArgumentException("type은 " + TextChangeRow.TYPES + " 중에서 골라야 합니다.");
            }
        }
        return types;
    }

    public static ToolLine textChange(TextChange change) {
        TextChangeRow row = change.row();
        TextChangeRow.Side shown = row.current() != null ? row.current() : row.previous();
        String rceptNo = shown == null ? null : shown.rceptNo();
        String text = shown == null || shown.text() == null ? "" : shown.text();
        String body = row.previous() != null && row.current() != null
                ? "이전: " + clip(row.previous().text()) + " / 현재: " + clip(row.current().text())
                : clip(text);
        return new ToolLine(Evidence.textChange(change.id(), row.changeType(), rceptNo, row.sectionPath(), text),
                "[" + row.changeType() + ", changeId " + change.id() + "] " + row.sectionPath() + ": " + body);
    }

    /** 문장 변경 한쪽의 원문 문단. 블록 번호가 없는 쪽(섹션 단위 검토 필요)이면 빈 값 */
    public static Optional<ToolLine> changeBlock(String side, TextChangeRow.Side block, String sectionPath) {
        if (block == null || block.blockNo() == null) {
            return Optional.empty();
        }
        return Optional.of(new ToolLine(Evidence.block(DocumentBlock.evidenceId(block.rceptNo(), block.blockNo()),
                side, block.rceptNo(), block.sectionNo(), block.blockNo(), sectionPath, block.text()),
                "[" + side + " 원문] " + sectionPath + ": " + clip(block.text())));
    }

    public static ToolLine block(String side, DocumentBlock block, String sectionPath) {
        return new ToolLine(Evidence.block(block.evidenceId(), side, block.rceptNo(), block.sectionNo(),
                block.blockNo(), sectionPath, block.text()), block.text());
    }

    public static ToolLine financialChange(FinancialChange c) {
        String sentence = QuestionFacts.fact(Evidence.financialChangeId(c.getId()), c).sentence();
        return new ToolLine(Evidence.financialChange(c.getId(), c.getSjDiv(), c.getAccountName(),
                c.getCurrentRceptNo(), sentence), "[" + c.getSjDiv() + ", changeId " + c.getId() + "] " + sentence,
                new ToolLine.Facts(c.getId(), c.direction(), c.getCalcStatus() == null ? null : c.getCalcStatus().name()));
    }

    /** 계정 이름에 찾을 글이 들어 있는지(공백 무시). q가 없으면 맞음 */
    public static boolean accountMatches(FinancialChange c, String q) {
        return q == null || squeeze(c.getAccountName()).contains(squeeze(q));
    }

    /** 목차: 최상위 항목마다 한 줄(표지 제외)과 그 아래 항목 번호·제목 */
    public static List<ToolLine> outline(String side, String rceptNo, List<DocumentSection> sections) {
        Map<Integer, List<DocumentSection>> children = new LinkedHashMap<>();
        sections.stream().filter(s -> s.parentNo() != null)
                .forEach(s -> children.computeIfAbsent(s.parentNo(), k -> new ArrayList<>()).add(s));
        return sections.stream()
                .filter(s -> s.parentNo() == null && !s.cover())
                .map(top -> new ToolLine(Evidence.section(side, rceptNo, top.sectionNo(), top.title()),
                        "[항목 " + top.sectionNo() + "] " + top.title() + childTitles(children.get(top.sectionNo()))))
                .toList();
    }

    private static String childTitles(List<DocumentSection> children) {
        if (children == null || children.isEmpty()) {
            return "";
        }
        StringBuilder out = new StringBuilder(" — 하위:");
        for (DocumentSection child : children) {
            out.append(" [항목 ").append(child.sectionNo()).append("] ").append(child.title());
        }
        return out.toString();
    }

    private static String clip(String text) {
        if (text == null) {
            return "";
        }
        return text.length() <= LINE_CHARS ? text : text.substring(0, LINE_CHARS) + "…";
    }

    private static String squeeze(String text) {
        return text == null ? "" : text.replaceAll("\\s+", "");
    }
}
