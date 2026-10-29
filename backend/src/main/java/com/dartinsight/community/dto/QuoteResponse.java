package com.dartinsight.community.dto;

import com.dartinsight.analysis.domain.Analysis;
import com.dartinsight.community.domain.CommunityQuote;
import com.dartinsight.community.domain.QuoteKind;

/**
 * 글에 붙인 변경점 인용(API 명세 6.6 Post.quote). label·text·reportPair는 담을 때의 사본이다.
 *
 * @param changeType 문장만. 재무는 null
 * @param sjDiv      재무만. 문장은 null
 * @param outdated   담을 때의 분석 버전이 지금 서버 버전과 다름(판단 노트와 같은 기준)
 */
public record QuoteResponse(
        QuoteKind kind,
        String label,
        String text,
        String changeType,
        String sjDiv,
        ReportPair reportPair,
        Source source,
        boolean outdated) {

    public record ReportPair(String previous, String current) {
    }

    /** 원래 위치. 결과 화면의 그 변경으로 돌아간다. sectionNo·blockNo는 문장만 */
    public record Source(long analysisId, long changeId, String rceptNo, Integer sectionNo, Integer blockNo) {
    }

    public static QuoteResponse from(CommunityQuote quote) {
        return new QuoteResponse(quote.getKind(), quote.getSnapshotLabel(), quote.getSnapshotText(),
                quote.getChangeType(), quote.getSjDiv(),
                new ReportPair(quote.getPreviousReportName(), quote.getCurrentReportName()),
                new Source(quote.getAnalysisId(), quote.getChangeId(), quote.getRceptNo(), quote.getSectionNo(),
                        quote.getBlockNo()),
                quote.isOutdated(Analysis.CURRENT_VERSION));
    }
}
