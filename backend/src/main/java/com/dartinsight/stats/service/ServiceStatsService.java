package com.dartinsight.stats.service;

import com.dartinsight.analysis.service.AnalysisMonitorService;
import com.dartinsight.analysis.service.TextChangeQueryService;
import com.dartinsight.company.service.CompanyService;
import com.dartinsight.stats.domain.ServiceStats;
import java.time.Clock;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.concurrent.atomic.AtomicReference;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 첫 화면 숫자 줄(#866). 각 표는 그 도메인 Service로 센다(PKG-3).
 * 첫 화면마다 COUNT를 돌리지 않게 센 값을 TTL 동안 기억한다. 서버가 여럿이면 서버마다 따로 센다.
 */
@Service
@Transactional(readOnly = true)
@RequiredArgsConstructor
public class ServiceStatsService {
    static final Duration TTL = Duration.ofMinutes(10);

    private final CompanyService companyService;
    private final AnalysisMonitorService analysisMonitorService;
    private final TextChangeQueryService textChangeQueryService;
    private final Clock clock;
    private final AtomicReference<ServiceStats> cached = new AtomicReference<>();

    public ServiceStats current() {
        LocalDateTime now = LocalDateTime.now(clock);
        ServiceStats last = cached.get();
        if (last != null && last.freshAt(now, TTL)) {
            return last;
        }
        ServiceStats counted = new ServiceStats(companyService.countListed(),
                analysisMonitorService.countCompleted(), textChangeQueryService.countCompleted(), now);
        cached.set(counted);
        return counted;
    }
}
