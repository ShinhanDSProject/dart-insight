package com.dartinsight.document;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ReportDocumentRepository extends JpaRepository<ReportDocument, Long> {

    Optional<ReportDocument> findByRceptNo(String rceptNo);
}
