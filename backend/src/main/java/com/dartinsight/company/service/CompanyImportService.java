package com.dartinsight.company.service;

import com.dartinsight.company.domain.Company;
import com.dartinsight.company.repository.CompanyRepository;
import com.dartinsight.dart.dto.CorpCodeEntry;
import com.dartinsight.dart.client.CorpCodeParser;
import com.dartinsight.dart.client.OpenDartClient;
import jakarta.persistence.EntityManager;
import java.time.Clock;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * OpenDART 고유번호 목록(corpCode.xml)을 받아 company 테이블에 넣거나 고친다(4.4).
 * 10만 건이 넘으므로 1,000건씩 나눠 저장한다. 다시 실행해도 중복이 생기지 않는다.
 */
@Service
@RequiredArgsConstructor
public class CompanyImportService {

    static final int CHUNK_SIZE = 1_000;
    private static final Logger log = LoggerFactory.getLogger(CompanyImportService.class);

    private final OpenDartClient openDartClient;
    private final CorpCodeParser corpCodeParser;
    private final CompanyRepository companyRepository;
    private final TransactionTemplate transactionTemplate;
    private final EntityManager entityManager;
    private final Clock clock;

    /** OpenDART에서 받아 저장한다. 받기나 읽기에 실패하면 기존 데이터는 그대로 둔다. */
    public ImportResult importFromOpenDart() {
        byte[] zip = openDartClient.downloadCorpCodes();
        List<CorpCodeEntry> entries = corpCodeParser.parse(zip);
        ImportResult result = save(entries);
        log.info("기업 목록 저장: 전체 {}건, 새로 추가 {}건, 수정 {}건", result.total(), result.inserted(), result.updated());
        return result;
    }

    public ImportResult save(List<CorpCodeEntry> entries) {
        // 같은 고유번호가 두 번 나오면 뒤의 값을 쓴다
        List<CorpCodeEntry> unique = new ArrayList<>(entries.stream()
                .collect(Collectors.toMap(CorpCodeEntry::corpCode, Function.identity(), (a, b) -> b,
                        LinkedHashMap::new))
                .values());
        if (companyRepository.count() == 0) {
            // 처음 받을 때는 한 트랜잭션으로 저장한다. 중간에 실패하면 빈 채로 남아 다음 시작 때 다시 받는다
            // (일부만 저장되면 on-empty 설정에서 다시 받지 않아 목록이 빠진 채로 남기 때문)
            return transactionTemplate.execute(status -> saveChunks(unique, true));
        }
        return saveChunks(unique, false);
    }

    /**
     * 1,000건씩 저장한다. inOneTransaction이면 이미 열린 트랜잭션 안에서 덩어리마다 비워 메모리를 아끼고,
     * 아니면 덩어리마다 따로 커밋한다(이미 있는 목록을 고칠 때는 일부만 반영돼도 기존 값이 남아 있음).
     */
    private ImportResult saveChunks(List<CorpCodeEntry> unique, boolean inOneTransaction) {
        int inserted = 0;
        int updated = 0;
        for (int from = 0; from < unique.size(); from += CHUNK_SIZE) {
            List<CorpCodeEntry> chunk = unique.subList(from, Math.min(from + CHUNK_SIZE, unique.size()));
            int[] counts;
            if (inOneTransaction) {
                counts = saveChunk(chunk);
                entityManager.flush();
                entityManager.clear();
            } else {
                counts = transactionTemplate.execute(status -> saveChunk(chunk));
            }
            inserted += counts[0];
            updated += counts[1];
        }
        return new ImportResult(unique.size(), inserted, updated);
    }

    private int[] saveChunk(List<CorpCodeEntry> chunk) {
        LocalDateTime now = LocalDateTime.now(clock);
        Map<String, Company> existing = companyRepository
                .findAllById(chunk.stream().map(CorpCodeEntry::corpCode).toList())
                .stream()
                .collect(Collectors.toMap(Company::getCorpCode, Function.identity()));
        List<Company> created = new ArrayList<>();
        int updated = 0;
        for (CorpCodeEntry entry : chunk) {
            Company company = existing.get(entry.corpCode());
            if (company == null) {
                created.add(Company.create(entry, now));
            } else if (company.updateFrom(entry, now)) {
                updated++;
            }
        }
        companyRepository.saveAll(created);
        return new int[] {created.size(), updated};
    }

    public record ImportResult(int total, int inserted, int updated) {
    }
}
