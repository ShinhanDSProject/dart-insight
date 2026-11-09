package com.dartinsight.glossary.domain;

import java.time.LocalDate;
import java.util.List;
import java.util.stream.Stream;

/**
 * 공시 용어 카드 하나(ADR-0061). 내용은 사람이 쓰고 PR 리뷰로 검토한다. 정의를 AI가 만들지 않는다.
 *
 * @param key          카드 키. frontend {@code GlossaryKey}와 같은 이름
 * @param level        수준
 * @param term         용어
 * @param aliases      별칭. 없으면 빈 목록
 * @param definition   한 줄 뜻
 * @param example      쉬운 예시. 어느 회사의 실제 값이 아니다. 없으면 null
 * @param whereToCheck 확인할 곳. 없으면 null
 * @param noJudgment   판단하지 않는다는 문구. 없으면 null
 * @param related      관련 용어 카드 키. 없으면 빈 목록
 * @param companyValue 이 회사 값을 찾을 곳. 없으면 null
 * @param sources      확인한 공식 자료. 없으면 빈 목록
 * @param reviewer     검토자. 없으면 null
 * @param reviewedAt   검토일. 없으면 null
 */
public record GlossaryTerm(
        String key,
        GlossaryLevel level,
        String term,
        List<String> aliases,
        String definition,
        String example,
        String whereToCheck,
        String noJudgment,
        List<String> related,
        GlossaryCompanyValue companyValue,
        List<GlossarySource> sources,
        String reviewer,
        LocalDate reviewedAt) {

    public GlossaryTerm {
        aliases = aliases == null ? List.of() : List.copyOf(aliases);
        related = related == null ? List.of() : List.copyOf(related);
        sources = sources == null ? List.of() : List.copyOf(sources);
    }

    /** 확인한 출처와 검토일이 있어 화면·채팅에 내보낼 수 있는지(AC9). */
    public boolean isPublishable() {
        return reviewedAt != null && !sources.isEmpty() && sources.stream().allMatch(GlossarySource::isComplete);
    }

    /** 용어와 별칭. 사용자가 부르는 이름들이다. */
    public List<String> names() {
        return Stream.concat(Stream.of(term), aliases.stream()).toList();
    }
}
