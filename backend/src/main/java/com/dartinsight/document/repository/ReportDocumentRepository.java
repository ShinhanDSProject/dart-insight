package com.dartinsight.document.repository;

import com.dartinsight.document.domain.ReportDocument;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ReportDocumentRepository extends JpaRepository<ReportDocument, Long> {

    Optional<ReportDocument> findByRceptNo(String rceptNo);
}
