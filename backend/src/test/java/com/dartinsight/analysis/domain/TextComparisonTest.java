package com.dartinsight.analysis.domain;

import static org.assertj.core.api.Assertions.assertThat;

import com.dartinsight.common.error.ApiException;
import com.dartinsight.common.error.ErrorCode;
import org.junit.jupiter.api.Test;

class TextComparisonTest {

    @Test
    void documentFailureShowsTheApiExceptionReason() {
        TextComparison failed = TextComparison.documentFailed(
                new ApiException(ErrorCode.DART_REQUEST_FAILED, "OpenDART에서 원문을 받지 못했어요."));

        assertThat(failed.status()).isEqualTo(TextStatus.FAILED);
        assertThat(failed.message()).isEqualTo(
                "원문을 받거나 읽지 못해 문장을 비교하지 못했어요. 다시 요청해 주세요. (OpenDART에서 원문을 받지 못했어요.)");
        assertThat(failed.rows()).isEmpty();
    }

    @Test
    void documentFailureHidesInternalExceptionText() {
        TextComparison failed = TextComparison.documentFailed(
                new IllegalStateException("could not write /data/documents/20260814000001.zip"));

        assertThat(failed.status()).isEqualTo(TextStatus.FAILED);
        assertThat(failed.message()).isEqualTo("원문을 받거나 읽지 못해 문장을 비교하지 못했어요. 다시 요청해 주세요.");
    }
}
