package com.dartinsight.analysis.service;

import com.dartinsight.analysis.domain.Analysis;
import com.dartinsight.analysis.domain.AnalysisStatus;
import com.dartinsight.analysis.domain.TextChange;
import com.dartinsight.analysis.domain.TextChangeRow;
import com.dartinsight.analysis.domain.TextChangeRow.Side;
import com.dartinsight.analysis.domain.TextStatus;
import com.dartinsight.analysis.repository.AnalysisRepository;
import com.dartinsight.analysis.repository.TextChangeStore;
import com.dartinsight.common.error.ApiException;
import com.dartinsight.common.error.ErrorCode;
import com.dartinsight.document.domain.DocumentBlock;
import com.dartinsight.document.domain.ReportDocument;
import com.dartinsight.document.service.DocumentService;
import com.dartinsight.report.domain.Report;
import com.dartinsight.report.service.ReportService;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Stream;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 문장 변경 이력(3.8, ADR-0028). 이미 완료된 분석을 이어 붙이고, 저장된 글이 똑같은 변경 항목으로 글을 따라간다.
 * 새 분석을 만들지 않고 OpenDART·ai-server를 부르지 않는다. 알 수 없는 기간은 '변경 없음'으로 보이지 않게 따로 표시한다.
 */
@Service
@Transactional(readOnly = true)
@RequiredArgsConstructor
public class TextChangeHistoryService {

    /** 한 방향으로 이어 붙이는 최대 분석 수 */
    static final int MAX_LINKS = 20;

    private static final Comparator<Report> BY_PERIOD = Comparator.comparing(Report::getPeriodEnd)
            .thenComparing(Report::getRceptDt);

    private final AnalysisResultService resultService;
    private final AnalysisRepository analysisRepository;
    private final TextChangeStore store;
    private final ReportService reportService;
    private final DocumentService documentService;

    public List<HistoryEntry> history(Long analysisId, Long changeId) {
        Analysis selected = resultService.completed(analysisId);
        TextChange change = store.find(analysisId, changeId)
                .orElseThrow(() -> new ApiException(ErrorCode.ANALYSIS_TEXT_CHANGE_NOT_FOUND));
        Links links = links(selected);
        Report previous = links.report(selected.getPreviousRceptNo());
        Report current = links.report(selected.getCurrentRceptNo());
        TextChangeRow row = change.row();
        ChangeRef ref = ChangeRef.of(selected, change);

        Map<String, HistoryEntry> entries = new LinkedHashMap<>();
        if (TextChangeRow.REVIEW_NEEDED.equals(row.changeType())) {
            entries.put(previous.getRceptNo(), HistoryEntry.unknown(previous, Status.REVIEW_NEEDED, null));
            entries.put(current.getRceptNo(), HistoryEntry.unknown(current, Status.REVIEW_NEEDED, ref));
            return ordered(entries, links);
        }
        entries.put(previous.getRceptNo(), fromSide(previous, row.previous(), previousPath(row), null));
        entries.put(current.getRceptNo(), fromSide(current, row.current(), row.sectionPath(), ref));
        walk(links, entries, previous, row.previous(), previousPath(row), true);
        walk(links, entries, current, row.current(), row.sectionPath(), false);
        return ordered(entries, links);
    }

    /**
     * 한 방향으로 분석을 이어 붙인다. backward면 from을 현재 보고서로 둔 분석으로 과거로, 아니면 이전 보고서로 둔 분석으로 미래로 간다.
     * 따라가는 글이 없으면(과거로 가다 추가, 미래로 가다 삭제를 만남) 더 가지 않는다.
     */
    private void walk(Links links, Map<String, HistoryEntry> entries, Report from, Side side, String startPath,
            boolean backward) {
        String text = side == null ? null : side.text();
        String path = startPath;
        Report at = from;
        for (int i = 0; i < MAX_LINKS && text != null; i++) {
            Optional<Analysis> link = links.next(at, backward);
            if (link.isEmpty()) {
                links.neighbor(at, backward).ifPresent(gap -> entries.putIfAbsent(gap.getRceptNo(),
                        HistoryEntry.unknown(gap, Status.NOT_ANALYZED, null)));
                return;
            }
            Analysis analysis = link.get();
            Report next = links.report(backward ? analysis.getPreviousRceptNo() : analysis.getCurrentRceptNo());
            // 과거로 갈 때는 이 분석의 현재 쪽 글, 미래로 갈 때는 이전 쪽 글이 지금 따라가는 글이다
            Optional<TextChange> found = store.findByText(analysis.getId(), backward, text);
            if (found.isPresent()) {
                TextChangeRow row = found.get().row();
                ChangeRef ref = ChangeRef.of(analysis, found.get());
                Side nextSide = backward ? row.previous() : row.current();
                String nextPath = backward ? previousPath(row) : row.sectionPath();
                if (backward) {
                    // 이 변경은 next → at으로 오며 생긴 것이라 at 항목에 붙인다
                    entries.computeIfPresent(at.getRceptNo(), (k, entry) -> entry.withChange(ref));
                    entries.put(next.getRceptNo(), fromSide(next, nextSide, nextPath, null));
                } else {
                    entries.put(next.getRceptNo(), fromSide(next, nextSide, nextPath, ref));
                }
                text = nextSide == null ? null : nextSide.text();
                path = nextPath;
            } else if (analysis.getTextStatus() == TextStatus.PARTIAL || store.hasReviewNeeded(analysis.getId(), path)) {
                entries.put(next.getRceptNo(), HistoryEntry.unknown(next, Status.REVIEW_NEEDED, null));
                return;
            } else {
                // 같은 글의 변경이 없으니 바뀌지 않았다. 화면에 보일 글은 그 보고서의 저장된 원문에서 위치를 찾는다
                HistoryEntry unchanged = unchanged(next, text);
                entries.put(next.getRceptNo(), unchanged);
                if (unchanged.sectionPath() != null) {
                    path = unchanged.sectionPath();
                }
            }
            at = next;
        }
    }

    /** 바뀌지 않은 보고서. 저장된 원문에 글이 똑같은 블록이 있어야 글과 위치를 보여 준다 */
    private HistoryEntry unchanged(Report report, String text) {
        Optional<ReportDocument> document = documentService.find(report.getRceptNo())
                .filter(d -> d.getStatus().usable());
        if (document.isEmpty()) {
            return HistoryEntry.unknown(report, Status.REVIEW_NEEDED, null);
        }
        return documentService.blocks(document.get()).stream()
                .filter(block -> text.equals(block.text()))
                .findFirst()
                .map(block -> new HistoryEntry(report, Status.PRESENT, text,
                        TextEvidenceService.paths(documentService.sections(document.get())).get(block.sectionNo()),
                        DocumentBlock.evidenceId(report.getRceptNo(), block.blockNo()), null))
                .orElseGet(() -> HistoryEntry.unknown(report, Status.REVIEW_NEEDED, null));
    }

    private static HistoryEntry fromSide(Report report, Side side, String path, ChangeRef ref) {
        if (side == null) {
            return new HistoryEntry(report, Status.ABSENT, null, null, null, ref);
        }
        if (side.blockNo() == null) {
            return HistoryEntry.unknown(report, Status.REVIEW_NEEDED, ref);
        }
        return new HistoryEntry(report, Status.PRESENT, side.text(), path,
                DocumentBlock.evidenceId(side.rceptNo(), side.blockNo()), ref);
    }

    /** 이전 보고서 쪽 섹션 경로. 위치 이동이 아니면 sectionPath와 같다 */
    private static String previousPath(TextChangeRow row) {
        return row.previousSectionPath() != null ? row.previousSectionPath() : row.sectionPath();
    }

    /**
     * 오래된 기간부터. 이어 붙인 분석이 건너뛴 보고서(두 항목 사이 기간의 목록 보고서)는 NOT_ANALYZED로 끼운다.
     */
    private static List<HistoryEntry> ordered(Map<String, HistoryEntry> entries, Links links) {
        List<HistoryEntry> sorted = entries.values().stream()
                .sorted(Comparator.comparing(HistoryEntry::report, BY_PERIOD)).toList();
        List<HistoryEntry> result = new ArrayList<>();
        for (int i = 0; i < sorted.size(); i++) {
            if (i > 0) {
                Report older = sorted.get(i - 1).report();
                Report newer = sorted.get(i).report();
                links.listed().stream()
                        .filter(r -> r.getPeriodEnd().isAfter(older.getPeriodEnd())
                                && r.getPeriodEnd().isBefore(newer.getPeriodEnd()))
                        .forEach(gap -> result.add(HistoryEntry.unknown(gap, Status.NOT_ANALYZED, null)));
            }
            result.add(sorted.get(i));
        }
        return result;
    }

    private Links links(Analysis selected) {
        String corpCode = selected.getCorpCode();
        // 문장 비교가 실패한 분석을 먼저 빼고, 같은 보고서 쌍이 여러 번 남으면 가장 최근 것만(완료 시각 최근 순으로 받음).
        // 순서가 반대면 최신 분석이 실패했을 때 그 전의 정상 분석까지 빠진다
        Set<String> seen = new HashSet<>();
        List<Analysis> analyses = analysisRepository
                .findByCorpCodeAndStatusOrderByCompletedAtDescIdDesc(corpCode, AnalysisStatus.COMPLETED).stream()
                .filter(a -> a.getTextStatus() != null && a.getTextStatus() != TextStatus.FAILED)
                .filter(a -> seen.add(a.getPreviousRceptNo() + ">" + a.getCurrentRceptNo()))
                .toList();
        List<Report> listed = reportService.stored(corpCode).stream().sorted(BY_PERIOD).toList();
        Map<String, Report> reports = new LinkedHashMap<>();
        listed.forEach(r -> reports.put(r.getRceptNo(), r));
        // 분석한 보고서가 정정 공시로 대체돼 목록에 없을 수 있어 따로 읽는다
        reports.putAll(reportService.reports(Stream.concat(Stream.of(selected), analyses.stream())
                .flatMap(a -> Stream.of(a.getPreviousRceptNo(), a.getCurrentRceptNo()))
                .filter(rceptNo -> !reports.containsKey(rceptNo))
                .distinct().toList()));
        return new Links(analyses, reports, listed);
    }

    /** 이어 붙일 수 있는 완료 분석과 보고서 */
    private record Links(List<Analysis> analyses, Map<String, Report> reports, List<Report> listed) {

        Report report(String rceptNo) {
            Report report = reports.get(rceptNo);
            if (report == null) {
                throw new ApiException(ErrorCode.REPORT_NOT_FOUND);
            }
            return report;
        }

        /** at에서 한 칸 잇는 분석. 여럿이면 기간이 가장 가까운 보고서와 짝지은 것 */
        Optional<Analysis> next(Report at, boolean backward) {
            Comparator<Analysis> closest = Comparator.comparing(
                    a -> report(backward ? a.getPreviousRceptNo() : a.getCurrentRceptNo()), BY_PERIOD);
            Stream<Analysis> candidates = analyses.stream()
                    .filter(a -> at.getRceptNo().equals(backward ? a.getCurrentRceptNo() : a.getPreviousRceptNo()))
                    .filter(a -> reports.containsKey(backward ? a.getPreviousRceptNo() : a.getCurrentRceptNo()))
                    .filter(a -> {
                        Report other = report(backward ? a.getPreviousRceptNo() : a.getCurrentRceptNo());
                        return backward ? other.getPeriodEnd().isBefore(at.getPeriodEnd())
                                : other.getPeriodEnd().isAfter(at.getPeriodEnd());
                    });
            return backward ? candidates.max(closest) : candidates.min(closest);
        }

        /** 목록에서 at 바로 앞(backward) 또는 바로 뒤 기간의 보고서 */
        Optional<Report> neighbor(Report at, boolean backward) {
            Stream<Report> side = listed.stream().filter(r -> backward ? r.getPeriodEnd().isBefore(at.getPeriodEnd())
                    : r.getPeriodEnd().isAfter(at.getPeriodEnd()));
            return backward ? side.max(BY_PERIOD) : side.min(BY_PERIOD);
        }
    }

    public enum Status {
        PRESENT, ABSENT, NOT_ANALYZED, REVIEW_NEEDED
    }

    /** 이 보고서로 오며 생긴 변경 */
    public record ChangeRef(long analysisId, long changeId, String changeType) {

        static ChangeRef of(Analysis analysis, TextChange change) {
            return new ChangeRef(analysis.getId(), change.id(), change.row().changeType());
        }
    }

    /**
     * 이력의 보고서 하나.
     *
     * @param text        PRESENT일 때 그 보고서의 글
     * @param sectionPath PRESENT일 때 근거 섹션 경로
     * @param evidenceId  PRESENT일 때 근거 ID({rceptNo}#B{blockNo})
     * @param change      바로 앞 항목에서 이 보고서로 오며 생긴 변경. 바뀌지 않았거나 알 수 없으면 null
     */
    public record HistoryEntry(Report report, Status status, String text, String sectionPath, String evidenceId,
            ChangeRef change) {

        static HistoryEntry unknown(Report report, Status status, ChangeRef change) {
            return new HistoryEntry(report, status, null, null, null, change);
        }

        HistoryEntry withChange(ChangeRef ref) {
            return new HistoryEntry(report, status, text, sectionPath, evidenceId, ref);
        }
    }
}
