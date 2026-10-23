package com.dartinsight.document.domain;

import static org.assertj.core.api.Assertions.assertThat;

import com.dartinsight.document.dto.StructuredDocumentResponse.Cell;
import java.util.List;
import org.junit.jupiter.api.Test;

class TableJsonTest {

    @Test
    void writesCellsWithOnlyNonDefaultAttributes() {
        String json = TableJson.write(List.of(
                List.of(new Cell("구분", true, 2, null), new Cell("금액", true, null, null)),
                List.of(new Cell("매출", null, 1, 2), new Cell("1,000", false, null, null))));

        assertThat(json).isEqualTo("[[{\"text\":\"구분\",\"header\":true,\"colspan\":2},"
                + "{\"text\":\"금액\",\"header\":true}],[{\"text\":\"매출\",\"rowspan\":2},{\"text\":\"1,000\"}]]");
    }

    @Test
    void escapesQuotesBackslashesAndControlCharacters() {
        assertThat(TableJson.quote("a\"b\\c\nd\u0001")).isEqualTo("\"a\\\"b\\\\c\\nd\\u0001\"");
    }

    @Test
    void noRowsIsNull() {
        assertThat(TableJson.write(null)).isNull();
        assertThat(TableJson.write(List.of())).isEqualTo("[]");
    }
}
