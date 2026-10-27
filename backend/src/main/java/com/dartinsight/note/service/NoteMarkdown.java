package com.dartinsight.note.service;

import com.dartinsight.note.domain.NoteKind;
import com.dartinsight.note.dto.NoteItemResponse;
import com.dartinsight.note.dto.NoteItemResponse.Source;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;

/**
 * 기업 노트 내보내기(AC5). 항목마다 이름, 담은 값·문장, 메모, 접수번호·위치, DART 원문 주소를 적는다.
 * 코드로만 만든다(LLM을 쓰지 않음).
 */
final class NoteMarkdown {
    static final String OUTDATED_NOTE = "분석 방식이 바뀌어 위치가 달라졌을 수 있어요. 담은 값은 담을 때 그대로예요.";
    private static final DateTimeFormatter TIME = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");
    private static final Map<String, String> CHANGE_TYPES = Map.of(
            "ADDED", "추가", "DELETED", "삭제", "MODIFIED", "수정", "NUMERIC_UPDATE", "숫자만 바뀜",
            "MOVED", "위치 이동", "REVIEW_NEEDED", "검토 필요");

    private NoteMarkdown() {
    }

    static String write(String corpName, String corpCode, List<NoteItemResponse> items, LocalDateTime now) {
        StringBuilder md = new StringBuilder()
                .append("# ").append(corpName).append(" 판단 노트\n\n")
                .append("- 고유번호: ").append(corpCode).append('\n')
                .append("- 내보낸 시각: ").append(now.format(TIME)).append(" (한국 시간)\n")
                .append("- 출처: 금융감독원 전자공시시스템(DART). 담은 값·문장은 담을 때의 분석 결과이며, ")
                .append("투자 판단을 돕는 정보가 아니고 매수·매도를 권하지 않습니다.\n");
        if (items.isEmpty()) {
            return md.append("\n담은 항목이 없어요.\n").toString();
        }
        int no = 1;
        for (NoteItemResponse item : items) {
            md.append('\n');
            item(md, no++, item);
        }
        return md.toString();
    }

    private static void item(StringBuilder md, int no, NoteItemResponse item) {
        Source source = item.source();
        md.append("## ").append(no).append(". ").append(oneLine(item.label())).append('\n').append('\n');
        if (item.kind() == NoteKind.FINANCIAL_CHANGE) {
            md.append("- 종류: 재무 수치\n");
            md.append("- 담은 값: ").append(oneLine(item.text())).append('\n');
        } else {
            md.append("- 종류: 문장 변경");
            if (item.changeType() != null) {
                md.append(" · ").append(CHANGE_TYPES.getOrDefault(item.changeType(), item.changeType()));
            }
            md.append('\n').append("- 담은 문장:\n\n");
            for (String line : item.text().split("\\R")) {
                md.append("  > ").append(line).append('\n');
            }
            md.append('\n');
        }
        md.append("- 메모: ").append(item.memo() == null ? "없음" : oneLine(item.memo())).append('\n');
        md.append("- 근거: ").append(location(item.kind(), source)).append('\n');
        if (source.dartUrl() != null) {
            md.append("- DART 원문: ").append(source.dartUrl()).append('\n');
        }
        md.append("- 담은 시각: ").append(item.createdAt().format(TIME)).append('\n');
        if (item.outdated()) {
            md.append("- 안내: ").append(OUTDATED_NOTE).append('\n');
        }
    }

    private static String location(NoteKind kind, Source source) {
        StringBuilder text = new StringBuilder("접수번호 ").append(source.rceptNo());
        if (kind == NoteKind.FINANCIAL_CHANGE && source.sjDiv() != null) {
            text.append(" · 재무제표 ").append(source.sjDiv());
        }
        if (source.sectionNo() != null) {
            text.append(" · 섹션 ").append(source.sectionNo());
        }
        if (source.blockNo() != null) {
            text.append(" · 문단 ").append(source.blockNo());
        }
        if (source.analysisId() != null) {
            text.append(" · 분석 ").append(source.analysisId());
        }
        return text.toString();
    }

    /** 메모·이름의 줄바꿈을 목록 한 줄에 맞게 ' / '로 잇는다 */
    private static String oneLine(String text) {
        return text.strip().replaceAll("\\s*\\R\\s*", " / ");
    }
}
