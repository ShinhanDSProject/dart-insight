package com.dartinsight.glossary.repository;

import com.dartinsight.glossary.config.GlossaryProperties;
import com.dartinsight.glossary.domain.GlossaryTerm;
import com.dartinsight.glossary.domain.GlossaryTerms;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.util.List;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Repository;
import tools.jackson.databind.DeserializationFeature;
import tools.jackson.databind.json.JsonMapper;

/**
 * 용어 카드 파일 저장소(ADR-0061). 서버를 띄울 때 한 번 읽고 규칙을 확인한다.
 *
 * <p>파일이 없거나, 모르는 칸이 있거나, 규칙(키·이름 겹침, 없는 관련 용어)을 어기면 서버가 뜨지 않는다.
 * 카드를 고치는 일은 PR로 하므로 배포 없이 바뀌지 않는다.
 */
@Repository
public class GlossaryTermFile {

    private final GlossaryTerms terms;

    public GlossaryTermFile(GlossaryProperties properties, JsonMapper jsonMapper) {
        this.terms = read(properties.location(), jsonMapper);
    }

    /** 파일의 카드 묶음. */
    public GlossaryTerms terms() {
        return terms;
    }

    static GlossaryTerms read(Resource location, JsonMapper jsonMapper) {
        try (InputStream in = location.getInputStream()) {
            Content content = jsonMapper.readerFor(Content.class)
                    .with(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)
                    .readValue(in);
            if (content == null || content.terms() == null) {
                throw new IllegalStateException("용어 카드 파일에 terms 배열이 없습니다: " + location);
            }
            return GlossaryTerms.of(content.terms());
        } catch (IOException e) {
            throw new UncheckedIOException("용어 카드 파일을 읽지 못했습니다: " + location, e);
        }
    }

    /** 카드 파일의 모양: {@code {"terms": [...]}} */
    record Content(List<GlossaryTerm> terms) {
    }
}
