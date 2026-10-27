package com.dartinsight.user.repository;

import com.dartinsight.user.domain.LocalCredential;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface LocalCredentialRepository extends JpaRepository<LocalCredential, Long> {
    boolean existsByEmail(String email);
    Optional<LocalCredential> findByEmail(String email);
}
