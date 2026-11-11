package com.dartinsight.document.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

/** AI 서버 원문 구조화 응답(POST /internal/documents/{rceptNo}/structure). docs/api-spec.md 3절 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record StructuredDocumentResponse(
        String rceptNo,
        String parserVersion,
        String status,
        String failureCode,
        String failureMessage,
        String mainFile,
        String encoding,
        String documentName,
        String companyName,
        List<String> attachments,
        List<Notice> warnings,
        Map<String, Integer> counts,
        List<Section> sections) {

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Notice(String code, String message) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Section(Integer sectionNo, Integer parentNo, Integer level, String title, String ref, Boolean cover,
            List<Block> blocks) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Block(Integer blockNo, String type, String text, List<List<Cell>> rows) {

        String plainText() {
            if (rows == null || rows.isEmpty()) {
                return text == null ? "" : text;
            }
            return rows.stream()
                    .map(row -> row.stream().map(Cell::text).filter(Objects::nonNull)
                            .collect(Collectors.joining(" | ")))
                    .collect(Collectors.joining("\n"));
        }
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Cell(String text, Boolean header, Integer colspan, Integer rowspan) {
    }

    /** 문서 순서로 이은 글(표는 칸을 ' | '로 이음). limit자까지. 구조가 없으면 빈 글 */
    public String plainText(int limit) {
        if (sections == null) {
            return "";
        }
        StringBuilder text = new StringBuilder();
        for (Section section : sections) {
            for (Block block : section.blocks() == null ? List.<Block>of() : section.blocks()) {
                if (text.length() >= limit) {
                    return text.substring(0, limit);
                }
                text.append(block.plainText()).append('\n');
            }
        }
        return text.length() > limit ? text.substring(0, limit) : text.toString().strip();
    }

    public int count(String name) {
        Integer value = counts == null ? null : counts.get(name);
        return value == null ? 0 : value;
    }
}
