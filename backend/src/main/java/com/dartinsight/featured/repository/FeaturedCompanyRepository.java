package com.dartinsight.featured.repository;

import com.dartinsight.featured.domain.FeaturedCompany;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface FeaturedCompanyRepository extends JpaRepository<FeaturedCompany, Long> {
    List<FeaturedCompany> findAllByOrderByRankNoAsc();
}
