package com.dartinsight.dart.client;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.dartinsight.common.error.ApiException;
import com.dartinsight.dart.dto.CorpCodeEntry;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.List;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;
import org.junit.jupiter.api.Test;

class CorpCodeParserTest {

    private final CorpCodeParser parser = new CorpCodeParser();

    /** 테스트용 가짜 회사들. 실제 공시 자료가 아니다. */
    static final String SAMPLE_XML = """
            <?xml version="1.0" encoding="UTF-8"?>
            <result>
                <list>
                    <corp_code>00000001</corp_code>
                    <corp_name>예시전자</corp_name>
                    <corp_eng_name>Example Electronics</corp_eng_name>
                    <stock_code>900001</stock_code>
                    <modify_date>20260102</modify_date>
                </list>
                <list>
                    <corp_code>00000002</corp_code>
                    <corp_name>예시비상장 &amp; 파트너스</corp_name>
                    <corp_eng_name></corp_eng_name>
                    <stock_code> </stock_code>
                    <modify_date>20250315</modify_date>
                </list>
                <list>
                    <corp_code>00000003</corp_code>
                    <corp_name>예시화학</corp_name>
                    <corp_eng_name>Example Chemical</corp_eng_name>
                    <stock_code>900003</stock_code>
                    <modify_date></modify_date>
                </list>
            </result>
            """;

    static byte[] zip(String fileName, String content) throws IOException {
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        try (ZipOutputStream out = new ZipOutputStream(bytes)) {
            out.putNextEntry(new ZipEntry(fileName));
            out.write(content.getBytes(StandardCharsets.UTF_8));
            out.closeEntry();
        }
        return bytes.toByteArray();
    }

    @Test
    void parsesEveryCompanyAndKeepsLeadingZeros() throws IOException {
        List<CorpCodeEntry> entries = parser.parse(zip("CORPCODE.xml", SAMPLE_XML));

        assertThat(entries).hasSize(3);
        assertThat(entries.get(0)).isEqualTo(new CorpCodeEntry(
                "00000001", "예시전자", "Example Electronics", "900001", LocalDate.of(2026, 1, 2)));
    }

    @Test
    void blankStockCodeMeansUnlisted() throws IOException {
        CorpCodeEntry unlisted = parser.parse(zip("CORPCODE.xml", SAMPLE_XML)).get(1);

        assertThat(unlisted.corpName()).isEqualTo("예시비상장 & 파트너스");
        assertThat(unlisted.stockCode()).isNull();
        assertThat(unlisted.corpEngName()).isNull();
    }

    @Test
    void blankDateIsNull() throws IOException {
        assertThat(parser.parse(zip("CORPCODE.xml", SAMPLE_XML)).get(2).modifyDate()).isNull();
    }

    @Test
    void failsWhenXmlFileIsMissing() throws IOException {
        byte[] wrongZip = zip("other.xml", SAMPLE_XML);

        assertThatThrownBy(() -> parser.parse(wrongZip)).isInstanceOf(ApiException.class);
    }

    @Test
    void doesNotResolveExternalEntities() throws IOException {
        String xxe = """
                <?xml version="1.0" encoding="UTF-8"?>
                <!DOCTYPE result [<!ENTITY secret SYSTEM "file:///etc/hostname">]>
                <result><list><corp_code>00000009</corp_code><corp_name>&secret;</corp_name></list></result>
                """;

        assertThatThrownBy(() -> parser.parse(zip("CORPCODE.xml", xxe))).isInstanceOf(ApiException.class);
    }
}
