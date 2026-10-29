package com.dartinsight.community.domain;

import com.dartinsight.note.domain.NoteSnapshot;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * 글에 붙인 변경점 인용(6.6 #464). 판단 노트(ADR-0034)처럼 담을 때의 이름·글·보고서 쌍은 사본으로, 원래 위치는 참조로 둔다.
 * 글당 하나(UNIQUE post_id)이고, 글을 고쳐도 바뀌지 않는다.
 */
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Entity
@Table(name = "community_quote")
public class CommunityQuote {
    /** 카드에 보일 글은 노트(4,000자)보다 짧게 1,000자까지 */
    public static final int MAX_TEXT = 1000;
    public static final int MAX_REPORT_NAME = 200;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "post_id", nullable = false)
    private Long postId;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "kind", nullable = false, length = 20)
    private QuoteKind kind;

    @Column(name = "analysis_id", nullable = false)
    private Long analysisId;

    @Column(name = "analysis_version", nullable = false, length = 20)
    private String analysisVersion;

    @Column(name = "change_id", nullable = false)
    private Long changeId;

    @Column(name = "sj_div", length = 5)
    private String sjDiv;

    @Column(name = "change_type", length = 20)
    private String changeType;

    @Column(name = "rcept_no", nullable = false, length = 14)
    private String rceptNo;

    @Column(name = "section_no")
    private Integer sectionNo;

    @Column(name = "block_no")
    private Integer blockNo;

    @Column(name = "previous_report_name", nullable = false, length = MAX_REPORT_NAME)
    private String previousReportName;

    @Column(name = "current_report_name", nullable = false, length = MAX_REPORT_NAME)
    private String currentReportName;

    @Column(name = "snapshot_label", nullable = false, length = NoteSnapshot.MAX_LABEL)
    private String snapshotLabel;

    @Column(name = "snapshot_text", nullable = false, length = MAX_TEXT)
    private String snapshotText;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    public static CommunityQuote create(long postId, QuoteKind kind, NoteSnapshot snapshot, String previousReportName,
            String currentReportName, LocalDateTime now) {
        CommunityQuote quote = new CommunityQuote();
        quote.postId = postId;
        quote.kind = kind;
        quote.analysisId = snapshot.analysisId();
        quote.analysisVersion = snapshot.analysisVersion();
        quote.changeId = snapshot.changeId();
        quote.sjDiv = snapshot.sjDiv();
        quote.changeType = snapshot.changeType();
        quote.rceptNo = snapshot.rceptNo();
        quote.sectionNo = snapshot.sectionNo();
        quote.blockNo = snapshot.blockNo();
        quote.previousReportName = NoteSnapshot.clip(previousReportName, MAX_REPORT_NAME);
        quote.currentReportName = NoteSnapshot.clip(currentReportName, MAX_REPORT_NAME);
        quote.snapshotLabel = snapshot.label();
        quote.snapshotText = NoteSnapshot.clip(snapshot.text(), MAX_TEXT);
        quote.createdAt = now;
        return quote;
    }

    /** 담을 때의 분석 버전이 지금 서버의 분석 버전과 다른지(판단 노트와 같은 기준) */
    public boolean isOutdated(String currentVersion) {
        return !analysisVersion.equals(currentVersion);
    }
}
