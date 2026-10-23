package com.dartinsight.document.service;

import com.dartinsight.aiserver.client.AiServerClient;
import com.dartinsight.aiserver.client.AiServerException;
import com.dartinsight.aiserver.client.AiServerPaths;
import com.dartinsight.dart.client.OpenDartClient;
import com.dartinsight.dart.client.OpenDartClient.DocumentFile;
import com.dartinsight.document.domain.DocumentBlock;
import com.dartinsight.document.domain.DocumentSection;
import com.dartinsight.document.domain.DocumentStatus;
import com.dartinsight.document.domain.ReportDocument;
import com.dartinsight.document.dto.StructuredDocumentResponse;
import com.dartinsight.document.repository.DocumentFileCache;
import com.dartinsight.document.repository.DocumentStore;
import com.dartinsight.document.repository.ReportDocumentRepository;
import com.dartinsight.report.Report;
import java.time.Clock;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.function.Consumer;
import java.util.function.Supplier;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * 보고서 원문 수집·구조화(4.2).
 * <ol>
 *   <li>원문 ZIP은 디스크 캐시에 있으면 그것을, 없으면 OpenDART(document.xml)에서 받아 캐시에 둔다.</li>
 *   <li>ZIP을 AI 서버에 보내 목차·문단·표로 구조화하고, 결과(실패·경고 포함)를 접수번호로 저장한다.</li>
 *   <li>같은 파서 버전으로 구조화한 결과가 있으면 다시 하지 않는다.
 *       파서 버전이 바뀌면 캐시의 ZIP으로 다시 한다.</li>
 *   <li>OpenDART에 원문이 없으면(013·014) NOT_AVAILABLE로 남기고,
 *       보고서 목록에서 이 보고서를 다시 볼 때까지 다시 묻지 않는다.</li>
 * </ol>
 * OpenDART·AI 서버 호출 실패는 저장하지 않고 예외로 알린다(다음 요청에서 다시 시도).
 */
@Service
@RequiredArgsConstructor
public class DocumentService {

    private static final Logger log = LoggerFactory.getLogger(DocumentService.class);
    private static final Object[] LOCKS = new Object[64];

    static {
        for (int i = 0; i < LOCKS.length; i++) {
            LOCKS[i] = new Object();
        }
    }

    private final OpenDartClient openDartClient;
    private final AiServerClient aiServerClient;
    private final DocumentFileCache fileCache;
    private final ReportDocumentRepository documentRepository;
    private final DocumentStore store;
    private final TransactionTemplate transactionTemplate;
    private final Clock clock;

    /**
     * 보고서 원문을 구조화해 둔다. 이미 해 두었으면 그 결과를 돌려준다.
     *
     * @throws com.dartinsight.common.error.ApiException OpenDART 호출 실패(DART_*)
     * @throws AiServerException                          AI 서버 호출 실패
     */
    public ReportDocument ensureStructured(Report report) {
        String rceptNo = report.getRceptNo();
        synchronized (LOCKS[Math.floorMod(rceptNo.hashCode(), LOCKS.length)]) {
            Optional<ReportDocument> saved = documentRepository.findByRceptNo(rceptNo);
            if (saved.isPresent() && saved.get().getStatus() == DocumentStatus.NOT_AVAILABLE
                    && !report.getLastSeenAt().isAfter(saved.get().getFetchedAt())) {
                return saved.get();
            }
            String parserVersion = parserVersion();
            if (saved.isPresent() && saved.get().getStatus() != DocumentStatus.NOT_AVAILABLE
                    && Objects.equals(saved.get().getParserVersion(), parserVersion)) {
                return saved.get();
            }

            LocalDateTime fetchedAt = now();
            Optional<byte[]> cached = fileCache.read(rceptNo);
            byte[] zip;
            if (cached.isPresent()) {
                zip = cached.get();
                if (saved.isPresent() && saved.get().getStatus() != DocumentStatus.NOT_AVAILABLE) {
                    fetchedAt = saved.get().getFetchedAt();
                }
            } else {
                DocumentFile file = openDartClient.downloadDocument(rceptNo);
                if (!file.available()) {
                    log.info("원문 없음 {}: {} {}", rceptNo, file.status(), file.message());
                    return save(rceptNo, saved.map(ReportDocument::getId).orElse(null),
                            d -> d.markNotAvailable(file.status(), file.message(), now()),
                            () -> ReportDocument.notAvailable(rceptNo, file.status(), file.message(), now()), null);
                }
                zip = file.zip();
                fileCache.write(rceptNo, zip);
            }

            StructuredDocumentResponse response = aiServerClient.postBytes(
                    AiServerPaths.documentStructure(rceptNo), zip, MediaType.valueOf("application/zip"),
                    StructuredDocumentResponse.class);
            if (response == null || !rceptNo.equals(response.rceptNo())) {
                throw new AiServerException(null, "AI 서버가 다른 보고서의 구조화 결과를 돌려줬습니다.", null);
            }
            long zipBytes = zip.length;
            LocalDateTime fetched = fetchedAt;
            ReportDocument result = save(rceptNo, saved.map(ReportDocument::getId).orElse(null),
                    d -> d.apply(response, zipBytes, fetched, now()),
                    () -> ReportDocument.structured(rceptNo, response, zipBytes, fetched, now()), response.sections());
            log.info("원문 구조화 저장 {}: {} 섹션 {} 블록 {} 셀 {}/{}", rceptNo, result.getStatus(), result.getSectionCount(),
                    result.getBlockCount(), result.getCellCount(), result.getSourceCellCount());
            return result;
        }
    }

    public Optional<ReportDocument> find(String rceptNo) {
        return documentRepository.findByRceptNo(rceptNo);
    }

    public List<DocumentSection> sections(ReportDocument document) {
        return document.getStatus().usable() ? store.sections(document.getId()) : List.of();
    }

    public List<DocumentBlock> blocks(ReportDocument document) {
        return document.getStatus().usable() ? store.blocks(document.getId(), document.getRceptNo()) : List.of();
    }

    public List<DocumentBlock> sectionBlocks(ReportDocument document, int sectionNo) {
        return document.getStatus().usable()
                ? store.sectionBlocks(document.getId(), document.getRceptNo(), sectionNo) : List.of();
    }

    public Optional<DocumentBlock> block(ReportDocument document, int blockNo) {
        return document.getStatus().usable()
                ? store.block(document.getId(), document.getRceptNo(), blockNo) : Optional.empty();
    }

    private String parserVersion() {
        Map<?, ?> body = aiServerClient.get(AiServerPaths.DOCUMENT_PARSER, Map.class);
        Object version = body == null ? null : body.get("parserVersion");
        if (version == null) {
            throw new AiServerException(null, "AI 서버가 파서 버전을 알려 주지 않았습니다.", null);
        }
        return version.toString();
    }

    /** 기록을 새로 만들거나 바꾸고, 목차·문단을 같은 트랜잭션에서 바꾼다. */
    private ReportDocument save(String rceptNo, Long savedId, Consumer<ReportDocument> update,
            Supplier<ReportDocument> create, List<StructuredDocumentResponse.Section> sections) {
        try {
            return transactionTemplate.execute(status -> {
                ReportDocument document;
                if (savedId != null) {
                    document = documentRepository.findById(savedId).orElseThrow();
                    update.accept(document);
                    document = documentRepository.saveAndFlush(document);
                } else {
                    document = documentRepository.saveAndFlush(create.get());
                }
                if (document.getStatus().usable()) {
                    store.replace(document.getId(), sections);
                } else {
                    store.delete(document.getId());
                }
                return document;
            });
        } catch (DataIntegrityViolationException e) {
            // 같은 원문을 동시에 저장한 경우에만 그 결과를 쓴다
            return documentRepository.findByRceptNo(rceptNo).orElseThrow(() -> e);
        }
    }

    private LocalDateTime now() {
        return LocalDateTime.now(clock).truncatedTo(ChronoUnit.MICROS);
    }
}
