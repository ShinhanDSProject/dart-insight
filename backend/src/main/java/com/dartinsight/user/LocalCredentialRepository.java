package com.dartinsight.user;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface LocalCredentialRepository extends JpaRepository<LocalCredential, Long> {
    boolean existsByEmail(String email);
    Optional<LocalCredential> findByEmail(String email);
}
