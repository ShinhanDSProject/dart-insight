package com.dartinsight.glossary.repository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.dartinsight.glossary.domain.GlossaryTerm;
import com.dartinsight.glossary.domain.GlossaryTerms;
import java.nio.charset.StandardCharsets;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.ClassPathResource;
import tools.jackson.databind.json.JsonMapper;

class GlossaryTermFileTest {

    private static final JsonMapper JSON = JsonMapper.builder().build();

    private static ByteArrayResource json(String text) {
        return new ByteArrayResource(text.getBytes(StandardCharsets.UTF_8));
    }

    @Test
    @DisplayName("저장소의 카드 파일은 규칙을 지키고, 카드 63개를 모두 출처·검토일과 함께 내보낸다")
    void repositoryCardFileIsValidAndAllCardsArePublished() {
        GlossaryTerms terms = GlossaryTermFile.read(new ClassPathResource("glossary/terms.json"), JSON);
        List<String> existing = List.of("correction", "rceptNo", "corpCode", "fsDiv", "period", "amountBasis",
                "account", "restatement", "operatingMargin");

        assertThat(terms.all()).hasSize(63);
        assertThat(terms.all()).extracting(GlossaryTerm::key).startsWith(existing.toArray(String[]::new));
        assertThat(terms.published()).hasSize(63);
    }

    @Test
    @DisplayName("관련 용어가 없는 카드를 가리키는 파일은 읽지 않는다(서버가 뜨지 않음)")
    void rejectsFileWithUnknownRelated() {
        String text = """
                {"terms": [{"key": "asset", "level": "BASIC", "term": "자산", "definition": "뜻",
                "related": ["missing"]}]}""";

        assertThatThrownBy(() -> GlossaryTermFile.read(json(text), JSON))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("missing");
    }

    @Test
    @DisplayName("모르는 칸이 있거나 terms가 없는 파일은 읽지 않는다")
    void rejectsUnknownFieldsAndMissingTerms() {
        String typo = """
                {"terms": [{"key": "asset", "level": "BASIC", "term": "자산", "definiton": "오타"}]}""";

        assertThatThrownBy(() -> GlossaryTermFile.read(json(typo), JSON)).isInstanceOf(RuntimeException.class);
        assertThatThrownBy(() -> GlossaryTermFile.read(json("{}"), JSON)).isInstanceOf(IllegalStateException.class);
    }
}
