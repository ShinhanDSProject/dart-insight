package com.dartinsight.document;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.util.List;
import java.util.Map;

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
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Cell(String text, Boolean header, Integer colspan, Integer rowspan) {
    }

    public int count(String name) {
        Integer value = counts == null ? null : counts.get(name);
        return value == null ? 0 : value;
    }
}
