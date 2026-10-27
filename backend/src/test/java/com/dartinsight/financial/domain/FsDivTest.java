package com.dartinsight.financial.domain;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class FsDivTest {

    @Test
    @DisplayName("OpenDART fs_div는 앞뒤 공백을 빼고 읽고, 없거나 모르는 값은 빈 값이다")
    void readsOpenDartValue() {
        assertThat(FsDiv.fromOpenDart(" CFS ")).contains(FsDiv.CFS);
        assertThat(FsDiv.fromOpenDart("OFS")).contains(FsDiv.OFS);
        assertThat(FsDiv.fromOpenDart("XYZ")).isEmpty();
        assertThat(FsDiv.fromOpenDart(null)).isEmpty();
    }
}
