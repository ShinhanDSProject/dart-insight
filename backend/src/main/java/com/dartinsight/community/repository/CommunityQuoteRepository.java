package com.dartinsight.community.repository;

import com.dartinsight.community.domain.CommunityQuote;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CommunityQuoteRepository extends JpaRepository<CommunityQuote, Long> {
    List<CommunityQuote> findByPostIdIn(Collection<Long> postIds);
}
