package com.dartinsight.document;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * 보고서 원문 구조화 기록(docs/erd.md). 보고서(접수번호)마다 하나. 목차·문단·표는 document_section·document_block에 있다.
 */
@Entity
@Table(name = "report_document")
public class ReportDocument {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "rcept_no", nullable = false, length = 14)
    private String rceptNo;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "status", nullable = false, length = 20)
    private DocumentStatus status;

    @Column(name = "parser_version", length = 20)
    private String parserVersion;

    @Column(name = "failure_code", length = 50)
    private String failureCode;

    @Column(name = "failure_message", length = 500)
    private String failureMessage;

    @Column(name = "main_file", length = 200)
    private String mainFile;

    @Column(name = "encoding", length = 20)
    private String encoding;

    @Column(name = "warnings", length = 2000)
    private String warnings;

    @Column(name = "section_count", nullable = false)
    private int sectionCount;

    @Column(name = "block_count", nullable = false)
    private int blockCount;

    @Column(name = "cell_count", nullable = false)
    private int cellCount;

    @Column(name = "source_cell_count", nullable = false)
    private int sourceCellCount;

    @Column(name = "zip_bytes")
    private Long zipBytes;

    @Column(name = "fetched_at", nullable = false)
    private LocalDateTime fetchedAt;

    @Column(name = "structured_at")
    private LocalDateTime structuredAt;

    protected ReportDocument() {
    }

    public static ReportDocument notAvailable(String rceptNo, String dartStatus, String message, LocalDateTime now) {
        ReportDocument document = new ReportDocument();
        document.rceptNo = rceptNo;
        document.markNotAvailable(dartStatus, message, now);
        return document;
    }

    public static ReportDocument structured(String rceptNo, StructuredDocumentResponse response, long zipBytes,
            LocalDateTime fetchedAt, LocalDateTime now) {
        ReportDocument document = new ReportDocument();
        document.rceptNo = rceptNo;
        document.apply(response, zipBytes, fetchedAt, now);
        return document;
    }

    /** OpenDART에 원문이 없을 때(013·014). 목차·문단은 지운 상태여야 한다. */
    public void markNotAvailable(String dartStatus, String message, LocalDateTime now) {
        status = DocumentStatus.NOT_AVAILABLE;
        parserVersion = null;
        failureCode = "DART_" + (dartStatus == null ? "NO_FILE" : dartStatus);
        failureMessage = limit(message == null ? "OpenDART에 원문 파일이 없어요." : "OpenDART: " + message, 500);
        mainFile = null;
        encoding = null;
        warnings = null;
        sectionCount = 0;
        blockCount = 0;
        cellCount = 0;
        sourceCellCount = 0;
        zipBytes = null;
        fetchedAt = now;
        structuredAt = null;
    }

    /** AI 서버 구조화 결과로 바꾼다. */
    public void apply(StructuredDocumentResponse response, long zipBytes, LocalDateTime fetchedAt,
            LocalDateTime now) {
        status = parseStatus(response.status());
        parserVersion = limit(response.parserVersion(), 20);
        failureCode = limit(response.failureCode(), 50);
        failureMessage = limit(response.failureMessage(), 500);
        mainFile = limit(response.mainFile(), 200);
        encoding = limit(response.encoding(), 20);
        warnings = response.warnings() == null || response.warnings().isEmpty() ? null
                : limit(String.join("\n", response.warnings().stream()
                        .map(w -> w.code() + ": " + w.message()).toList()), 2000);
        sectionCount = response.sections() == null ? 0 : response.sections().size();
        blockCount = response.sections() == null ? 0 : response.sections().stream()
                .mapToInt(s -> s.blocks() == null ? 0 : s.blocks().size()).sum();
        cellCount = response.count("cells");
        sourceCellCount = response.count("sourceCells");
        this.zipBytes = zipBytes;
        this.fetchedAt = fetchedAt;
        structuredAt = now;
    }

    private static DocumentStatus parseStatus(String value) {
        try {
            DocumentStatus parsed = DocumentStatus.valueOf(value);
            return parsed == DocumentStatus.NOT_AVAILABLE ? DocumentStatus.FAILED : parsed;
        } catch (IllegalArgumentException | NullPointerException e) {
            return DocumentStatus.FAILED;
        }
    }

    private static String limit(String value, int max) {
        return value == null || value.length() <= max ? value : value.substring(0, max);
    }

    public Long getId() {
        return id;
    }

    public String getRceptNo() {
        return rceptNo;
    }

    public DocumentStatus getStatus() {
        return status;
    }

    public String getParserVersion() {
        return parserVersion;
    }

    public String getFailureCode() {
        return failureCode;
    }

    public String getFailureMessage() {
        return failureMessage;
    }

    public String getMainFile() {
        return mainFile;
    }

    public String getEncoding() {
        return encoding;
    }

    /** 경고. 한 줄에 하나({@code 코드: 설명}) */
    public String getWarnings() {
        return warnings;
    }

    public int getSectionCount() {
        return sectionCount;
    }

    public int getBlockCount() {
        return blockCount;
    }

    public int getCellCount() {
        return cellCount;
    }

    public int getSourceCellCount() {
        return sourceCellCount;
    }

    public Long getZipBytes() {
        return zipBytes;
    }

    public LocalDateTime getFetchedAt() {
        return fetchedAt;
    }

    public LocalDateTime getStructuredAt() {
        return structuredAt;
    }
}
