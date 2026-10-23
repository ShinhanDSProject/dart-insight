package com.dartinsight.user;

import org.springframework.data.jpa.repository.JpaRepository;

public interface LocalCredentialRepository extends JpaRepository<LocalCredential, Long> {
    boolean existsByEmail(String email);
}
