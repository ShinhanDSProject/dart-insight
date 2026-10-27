package com.dartinsight.season.service;

import com.dartinsight.common.error.ApiException;
import com.dartinsight.common.error.ErrorCode;
import com.dartinsight.company.domain.Company;
import com.dartinsight.company.service.CompanyService;
import com.dartinsight.report.domain.ReportType;
import com.dartinsight.season.domain.Season;
import com.dartinsight.season.domain.SeasonChange;
import com.dartinsight.season.domain.SeasonChangeStatus;
import com.dartinsight.season.repository.SeasonChangeRepository;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 시즌 변화 순위 저장·조회(1.7, #420, ADR-0037). 요청마다 계산하지 않고 저장된 순위만 읽는다 */
@Service
@Transactional(readOnly = true)
@RequiredArgsConstructor
public class SeasonChangeService {

    private static final Comparator<SeasonChange> BY_SCORE = Comparator.comparing(SeasonChange::getScore).reversed()
            .thenComparing(SeasonChange::getCorpCode);

    private final SeasonChangeRepository seasonChanges;
    private final CompanyService companyService;

    public boolean exists(Season season) {
        return seasonChanges.existsByReportTypeAndFiscalYear(season.reportType(), season.fiscalYear());
    }

    /** 점수 순으로 순위를 매겨 시즌 전체를 한 번에 저장하고 상위 top곳을 돌려준다 */
    @Transactional
    public List<SeasonChange> saveSeason(List<SeasonChange> rows, int top) {
        List<SeasonChange> scored = rows.stream().filter(r -> r.getStatus() == SeasonChangeStatus.SCORED)
                .sorted(BY_SCORE).toList();
        for (int i = 0; i < scored.size(); i++) {
            scored.get(i).rank(i + 1);
        }
        seasonChanges.saveAll(rows);
        return scored.stream().limit(top).toList();
    }

    /** 시즌 순위 상위 top곳(순위 순) */
    public List<SeasonChange> top(Season season, int top) {
        return seasonChanges.findByReportTypeAndFiscalYear(season.reportType(), season.fiscalYear()).stream()
                .filter(r -> r.getRankNo() != null && r.getRankNo() <= top)
                .sorted(Comparator.comparing(SeasonChange::getRankNo))
                .toList();
    }

    @Transactional
    public void linkAnalysis(long seasonChangeId, long analysisId) {
        seasonChanges.findById(seasonChangeId).ifPresent(row -> row.linkAnalysis(analysisId));
    }

    /** 계산한 시즌, 최근 순 */
    public List<Season> seasons() {
        return seasonChanges.findSeasons().stream()
                .map(r -> new Season((ReportType) r[0], (Integer) r[1]))
                .sorted(Comparator.comparing(Season::periodEnd).reversed())
                .toList();
    }

    /** season이 없으면 계산한 가장 최근 시즌. 계산한 시즌이 하나도 없으면 빈 값. 계산하지 않은 시즌이면 404 */
    public Optional<SeasonView> view(Season requested, int top) {
        List<Season> seasons = seasons();
        if (requested != null && !seasons.contains(requested)) {
            throw new ApiException(ErrorCode.COMMON_NOT_FOUND, "이 시즌의 순위는 아직 계산하지 않았어요.");
        }
        if (seasons.isEmpty()) {
            return Optional.empty();
        }
        Season season = requested != null ? requested : seasons.getFirst();
        List<SeasonChange> rows = seasonChanges.findByReportTypeAndFiscalYear(season.reportType(), season.fiscalYear());
        List<SeasonChange> ranked = rows.stream().filter(r -> r.getRankNo() != null)
                .sorted(Comparator.comparing(SeasonChange::getRankNo)).limit(top).toList();
        Map<String, Company> companies = companyService.getAll(ranked.stream().map(SeasonChange::getCorpCode).toList())
                .stream().collect(Collectors.toMap(Company::getCorpCode, Function.identity()));
        Map<SeasonChangeStatus, Long> counts = rows.stream()
                .collect(Collectors.groupingBy(SeasonChange::getStatus, Collectors.counting()));
        SeasonChange first = rows.getFirst();
        return Optional.of(new SeasonView(season, seasons, first.getComputedAt(), first.getCandidateCount(),
                counts.getOrDefault(SeasonChangeStatus.SCORED, 0L),
                counts.getOrDefault(SeasonChangeStatus.NO_REPORT, 0L),
                counts.getOrDefault(SeasonChangeStatus.FAILED, 0L),
                ranked.stream().map(r -> new RankedView(r, companies.get(r.getCorpCode()))).toList()));
    }

    public record SeasonView(Season season, List<Season> seasons, LocalDateTime computedAt,
            int candidateCount, long rankedCount, long noReport, long failed, List<RankedView> items) {
    }

    /** 순위 한 줄과 기업(기업 목록에서 빠졌으면 null) */
    public record RankedView(SeasonChange change, Company company) {
    }
}
