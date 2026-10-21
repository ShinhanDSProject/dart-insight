package com.dartinsight.dart;

import com.dartinsight.common.error.ApiException;
import com.dartinsight.common.error.ErrorCode;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import javax.xml.stream.XMLInputFactory;
import javax.xml.stream.XMLStreamConstants;
import javax.xml.stream.XMLStreamException;
import javax.xml.stream.XMLStreamReader;
import org.springframework.stereotype.Component;

/**
 * corpCode.xml ZIP을 읽어 회사 목록으로 바꾼다.
 * 파일이 크므로(10만 건 이상) DOM 대신 StAX로 한 건씩 읽는다.
 */
@Component
public class CorpCodeParser {

    private static final String XML_FILE = "CORPCODE.xml";

    public List<CorpCodeEntry> parse(byte[] zip) {
        try (ZipInputStream in = new ZipInputStream(new ByteArrayInputStream(zip))) {
            ZipEntry entry;
            while ((entry = in.getNextEntry()) != null) {
                if (entry.getName().equalsIgnoreCase(XML_FILE)) {
                    return parseXml(in);
                }
            }
        } catch (IOException | XMLStreamException e) {
            throw new ApiException(ErrorCode.DART_REQUEST_FAILED, "고유번호 파일을 읽을 수 없습니다.", e);
        }
        throw new ApiException(ErrorCode.DART_REQUEST_FAILED, "고유번호 파일에 " + XML_FILE + "이 없습니다.");
    }

    private List<CorpCodeEntry> parseXml(InputStream in) throws XMLStreamException {
        XMLInputFactory factory = XMLInputFactory.newFactory();
        // 외부 엔티티를 읽지 않는다(XXE 방지)
        factory.setProperty(XMLInputFactory.SUPPORT_DTD, false);
        factory.setProperty(XMLInputFactory.IS_SUPPORTING_EXTERNAL_ENTITIES, false);
        XMLStreamReader reader = factory.createXMLStreamReader(in, "UTF-8");

        List<CorpCodeEntry> result = new ArrayList<>();
        Map<String, String> fields = null;
        String current = null;
        StringBuilder text = new StringBuilder();
        while (reader.hasNext()) {
            int event = reader.next();
            if (event == XMLStreamConstants.START_ELEMENT) {
                String name = reader.getLocalName();
                if ("list".equals(name)) {
                    fields = new HashMap<>();
                } else if (fields != null) {
                    current = name;
                    text.setLength(0);
                }
            } else if (event == XMLStreamConstants.CHARACTERS || event == XMLStreamConstants.CDATA) {
                if (current != null) {
                    text.append(reader.getText());
                }
            } else if (event == XMLStreamConstants.END_ELEMENT) {
                String name = reader.getLocalName();
                if ("list".equals(name) && fields != null) {
                    toEntry(fields).ifPresent(result::add);
                    fields = null;
                } else if (fields != null && name.equals(current)) {
                    fields.put(current, text.toString().trim());
                    current = null;
                }
            }
        }
        reader.close();
        return result;
    }

    private static java.util.Optional<CorpCodeEntry> toEntry(Map<String, String> fields) {
        String corpCode = blankToNull(fields.get("corp_code"));
        String corpName = blankToNull(fields.get("corp_name"));
        if (corpCode == null || corpName == null) {
            return java.util.Optional.empty();
        }
        return java.util.Optional.of(new CorpCodeEntry(
                corpCode,
                corpName,
                blankToNull(fields.get("corp_eng_name")),
                blankToNull(fields.get("stock_code")),
                parseDate(fields.get("modify_date"))));
    }

    private static LocalDate parseDate(String value) {
        String text = blankToNull(value);
        if (text == null) {
            return null;
        }
        try {
            return LocalDate.parse(text, DateTimeFormatter.BASIC_ISO_DATE);
        } catch (DateTimeParseException e) {
            return null;
        }
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
