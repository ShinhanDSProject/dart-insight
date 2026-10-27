package com.dartinsight.season.dto;

import com.dartinsight.report.domain.ReportType;
import com.dartinsight.season.domain.Season;
import com.dartinsight.season.domain.SeasonScore;
import com.dartinsight.season.service.SeasonChangeService.RankedView;
import com.dartinsight.season.service.SeasonChangeService.SeasonView;
import com.fasterxml.jackson.annotation.JsonFormat;
import java.time.LocalDateTime;
import java.util.List;

/** 이번 시즌 변화가 큰 기업(1.7). 계산한 시즌이 없으면 season이 null이고 items가 비어 있다 */
public record SeasonChangeListResponse(
        SeasonRef season,
        List<SeasonKey> seasons,
        @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss") LocalDateTime computedAt,
        String scoreVersion,
        int candidateCount,
        long rankedCount,
        Excluded excluded,
        List<Item> items) {

    public static SeasonChangeListResponse empty() {
        return new SeasonChangeListResponse(null, List.of(), null, SeasonScore.VERSION, 0, 0, new Excluded(0, 0),
                List.of());
    }

    public static SeasonChangeListResponse from(SeasonView view) {
        return new SeasonChangeListResponse(SeasonRef.from(view.season()),
                view.seasons().stream().map(SeasonKey::from).toList(), view.computedAt(), SeasonScore.VERSION,
                view.candidateCount(), view.rankedCount(), new Excluded(view.noReport(), view.failed()),
                view.items().stream().map(Item::from).toList());
    }

    public record SeasonRef(ReportType reportType, int fiscalYear, int previousFiscalYear) {

        static SeasonRef from(Season season) {
            return new SeasonRef(season.reportType(), season.fiscalYear(), season.fiscalYear() - 1);
        }
    }

    public record SeasonKey(ReportType reportType, int fiscalYear) {

        static SeasonKey from(Season season) {
            return new SeasonKey(season.reportType(), season.fiscalYear());
        }
    }

    public record Excluded(long noReport, long failed) {
    }

    public record Item(int rank, String corpCode, String corpName, String stockCode, String previousRceptNo,
            String currentRceptNo, Integer changeCount, String highlight, Long analysisId) {

        static Item from(RankedView view) {
            var change = view.change();
            return new Item(change.getRankNo(), change.getCorpCode(),
                    view.company() == null ? null : view.company().getCorpName(),
                    view.company() == null ? null : view.company().getStockCode(), change.getPreviousRceptNo(),
                    change.getCurrentRceptNo(), change.getChangeCount(), change.getHighlight(),
                    change.getAnalysisId());
        }
    }
}
