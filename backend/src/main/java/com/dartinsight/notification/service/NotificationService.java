package com.dartinsight.notification.service;

import com.dartinsight.analysis.domain.Analysis;
import com.dartinsight.analysis.domain.AnalysisCompleted;
import com.dartinsight.analysis.domain.AnalysisStatus;
import com.dartinsight.analysis.service.AnalysisResultService;
import com.dartinsight.common.error.ApiException;
import com.dartinsight.common.error.ErrorCode;
import com.dartinsight.company.domain.Company;
import com.dartinsight.company.service.CompanyService;
import com.dartinsight.comparison.domain.ComparisonBasis;
import com.dartinsight.favorite.service.FavoriteCompanyService;
import com.dartinsight.notification.domain.Notification;
import com.dartinsight.notification.repository.NotificationRepository;
import com.dartinsight.notification.repository.WatchedReportRepository;
import com.dartinsight.report.domain.Report;
import com.dartinsight.report.service.ReportService;
import com.dartinsight.user.UserService;
import java.time.Clock;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * 분석 완료 알림(6.4, #38, ADR-0031). 즐겨찾기 폴링이 지켜보는 새 보고서의 전년 동기 분석이 완료돼 결과가 저장된 뒤에만,
 * 그 기업을 즐겨찾기한 회원마다 알림 하나를 만든다. 회원은 언제나 토큰의 사용자 ID로만 정한다.
 */
@Service
@Transactional(readOnly = true)
@RequiredArgsConstructor
public class NotificationService {

    private static final Logger log = LoggerFactory.getLogger(NotificationService.class);

    private final NotificationRepository notifications;
    private final WatchedReportRepository watchedReports;
    private final AnalysisResultService analysisResultService;
    private final FavoriteCompanyService favoriteCompanyService;
    private final ReportService reportService;
    private final CompanyService companyService;
    private final UserService userService;
    private final Clock clock;

    /** 결과 저장이 커밋된 뒤에만 부른다. 알림을 만들다 실패해도 분석 완료에는 영향을 주지 않는다 */
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void onCompleted(AnalysisCompleted event) {
        try {
            notifyIfWatched(analysisResultService.get(event.analysisId()));
        } catch (RuntimeException e) {
            log.error("분석 완료 알림을 만들지 못했습니다: 분석 {}", event.analysisId(), e);
        }
    }

    /** 완료된 전년 동기 분석이고 현재 보고서를 지켜보고 있으면, 그 기업을 즐겨찾기한 회원마다 알림을 만든다(이미 있으면 그대로) */
    @Transactional
    public void notifyIfWatched(Analysis analysis) {
        if (analysis.getStatus() != AnalysisStatus.COMPLETED || analysis.getBasis() != ComparisonBasis.YOY
                || !watchedReports.existsByRceptNo(analysis.getCurrentRceptNo())) {
            return;
        }
        LocalDateTime now = LocalDateTime.now(clock).truncatedTo(ChronoUnit.MICROS);
        int created = 0;
        for (Long userId : favoriteCompanyService.userIdsFavoriting(analysis.getCorpCode())) {
            if (!notifications.existsByUserIdAndAnalysisId(userId, analysis.getId())) {
                notifications.save(Notification.create(userId, analysis.getId(), now));
                created++;
            }
        }
        // 같은 완료가 동시에 두 번 들어와 위 확인을 함께 지나가면 UNIQUE(user_id, analysis_id)가 두 번째 저장을 막는다
        log.info("분석 완료 알림 {}건: 분석 {}", created, analysis.getId());
    }

    /** 최근 순 최대 limit개와 읽지 않은 전체 수 */
    public NotificationList list(long userId, int limit) {
        userService.requireExisting(userId);
        List<Notification> rows = notifications.findByUserIdOrderByCreatedAtDescIdDesc(userId,
                PageRequest.of(0, limit));
        List<Analysis> analyses = rows.stream().map(n -> analysisResultService.get(n.getAnalysisId())).toList();
        Map<String, Report> reports = reportService.reports(analyses.stream()
                .flatMap(a -> Stream.of(a.getPreviousRceptNo(), a.getCurrentRceptNo())).distinct().toList());
        Map<String, Company> companies = companyService.getAll(analyses.stream().map(Analysis::getCorpCode)
                .distinct().toList()).stream().collect(Collectors.toMap(Company::getCorpCode, Function.identity()));
        List<NotificationView> items = new ArrayList<>();
        for (int i = 0; i < rows.size(); i++) {
            Analysis analysis = analyses.get(i);
            items.add(new NotificationView(rows.get(i), analysis, companies.get(analysis.getCorpCode()),
                    reports.get(analysis.getPreviousRceptNo()), reports.get(analysis.getCurrentRceptNo())));
        }
        return new NotificationList(notifications.countByUserIdAndReadAtIsNull(userId), items);
    }

    @Transactional
    public void markRead(long userId, long notificationId) {
        find(userId, notificationId).markRead(LocalDateTime.now(clock).truncatedTo(ChronoUnit.MICROS));
    }

    @Transactional
    public void markUnread(long userId, long notificationId) {
        find(userId, notificationId).markUnread();
    }

    /** 다른 회원의 알림이면 없는 것과 같다(404) */
    private Notification find(long userId, long notificationId) {
        userService.requireExisting(userId);
        return notifications.findByIdAndUserId(notificationId, userId)
                .orElseThrow(() -> new ApiException(ErrorCode.ANALYSIS_NOTIFICATION_NOT_FOUND));
    }

    public record NotificationList(long unreadCount, List<NotificationView> items) {
    }

    /** 알림 하나와 화면에 보일 분석·기업·두 보고서 */
    public record NotificationView(Notification notification, Analysis analysis, Company company, Report previous,
            Report current) {
    }
}
