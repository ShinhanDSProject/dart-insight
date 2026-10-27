package com.dartinsight.summary.domain;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class EvidenceRefTest {

    @Test
    @DisplayName("근거 ID를 접수번호와 블록 번호로 나눈다")
    void parsesReceiptNumberAndBlockNumber() {
        assertThat(EvidenceRef.parse("20260814001234#B123")).isEqualTo(new EvidenceRef("20260814001234", 123));
    }

    @Test
    @DisplayName("'#B'가 없으면 둘 다 null, 블록 번호가 숫자가 아니면 블록 번호만 null")
    void leavesUnparsablePartsNull() {
        assertThat(EvidenceRef.parse("20260814001234")).isEqualTo(new EvidenceRef(null, null));
        assertThat(EvidenceRef.parse("20260814001234#Bx")).isEqualTo(new EvidenceRef("20260814001234", null));
    }
}
