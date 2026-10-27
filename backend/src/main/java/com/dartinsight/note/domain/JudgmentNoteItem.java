package com.dartinsight.note.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * 회원이 기업 노트에 담은 근거 한 건(6.5, #413, ADR-0034). 담을 때의 이름·값·문장(사본)과 원래 위치(참조), 메모를 둔다.
 * 사본은 담은 뒤 바뀌지 않는다. 바꿀 수 있는 것은 메모뿐이다.
 */
@Entity
@Table(name = "judgment_note_item")
public class JudgmentNoteItem {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "corp_code", nullable = false, length = 8)
    private String corpCode;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "kind", nullable = false, length = 20)
    private NoteKind kind;

    @Column(name = "analysis_id")
    private Long analysisId;

    @Column(name = "analysis_version", length = 20)
    private String analysisVersion;

    @Column(name = "change_id")
    private Long changeId;

    @Column(name = "sj_div", length = 5)
    private String sjDiv;

    @Column(name = "rcept_no", length = 14)
    private String rceptNo;

    @Column(name = "section_no")
    private Integer sectionNo;

    @Column(name = "block_no")
    private Integer blockNo;

    @Column(name = "change_type", length = 20)
    private String changeType;

    @Column(name = "snapshot_label", nullable = false, length = NoteSnapshot.MAX_LABEL)
    private String snapshotLabel;

    @Column(name = "snapshot_text", nullable = false, length = NoteSnapshot.MAX_TEXT)
    private String snapshotText;

    @Column(name = "question_id")
    private Long questionId;

    @Column(name = "snapshot_question", length = NoteSnapshot.MAX_QUESTION)
    private String snapshotQuestion;

    @Column(name = "doc_side", length = 10)
    private String docSide;

    @Column(name = "memo", length = 1000)
    private String memo;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    protected JudgmentNoteItem() {}

    public static JudgmentNoteItem create(long userId, NoteSnapshot snapshot, String memo, LocalDateTime now) {
        JudgmentNoteItem item = new JudgmentNoteItem();
        item.userId = userId;
        item.corpCode = snapshot.corpCode();
        item.kind = snapshot.kind();
        item.analysisId = snapshot.analysisId();
        item.analysisVersion = snapshot.analysisVersion();
        item.changeId = snapshot.changeId();
        item.sjDiv = snapshot.sjDiv();
        item.rceptNo = snapshot.rceptNo();
        item.sectionNo = snapshot.sectionNo();
        item.blockNo = snapshot.blockNo();
        item.changeType = snapshot.changeType();
        item.snapshotLabel = snapshot.label();
        item.snapshotText = snapshot.text();
        item.questionId = snapshot.questionId();
        item.snapshotQuestion = snapshot.question();
        item.docSide = snapshot.side();
        item.memo = memo;
        item.createdAt = now;
        item.updatedAt = now;
        return item;
    }

    /** 메모만 바꾼다. null이면 메모를 지운다 */
    public void changeMemo(String newMemo, LocalDateTime now) {
        this.memo = newMemo;
        this.updatedAt = now;
    }

    /** 담을 때의 분석 버전이 지금 서버의 분석 버전과 다른지(AC4) */
    public boolean isOutdated(String currentVersion) {
        return analysisVersion != null && !analysisVersion.equals(currentVersion);
    }

    public Long getId() { return id; }

    public Long getUserId() { return userId; }

    public String getCorpCode() { return corpCode; }

    public NoteKind getKind() { return kind; }

    public Long getAnalysisId() { return analysisId; }

    public String getAnalysisVersion() { return analysisVersion; }

    public Long getChangeId() { return changeId; }

    public String getSjDiv() { return sjDiv; }

    public String getRceptNo() { return rceptNo; }

    public Integer getSectionNo() { return sectionNo; }

    public Integer getBlockNo() { return blockNo; }

    public String getChangeType() { return changeType; }

    public String getSnapshotLabel() { return snapshotLabel; }

    public String getSnapshotText() { return snapshotText; }

    public Long getQuestionId() { return questionId; }

    public String getSnapshotQuestion() { return snapshotQuestion; }

    public String getDocSide() { return docSide; }

    public String getMemo() { return memo; }

    public LocalDateTime getCreatedAt() { return createdAt; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
}
