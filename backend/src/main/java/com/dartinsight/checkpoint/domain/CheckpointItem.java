package com.dartinsight.checkpoint.domain;

import com.dartinsight.disclosure.domain.Disclosure;
import java.util.List;

/**
 * 체크 포인트 한 항목의 결과.
 *
 * @param note        상태를 정한 이유가 수치만으로 보이지 않을 때의 사실 문장. 없으면 null
 * @param disclosures 센 공시(자금 조달·감사의견 항목). 그 밖은 빈 목록
 */
public record CheckpointItem(CheckpointKey key, CheckpointStatus status, String note, List<CheckpointFact> facts,
        List<Disclosure> disclosures) {

    static CheckpointItem of(CheckpointKey key, CheckpointStatus status, String note, List<CheckpointFact> facts) {
        return new CheckpointItem(key, status, note, List.copyOf(facts), List.of());
    }
}
