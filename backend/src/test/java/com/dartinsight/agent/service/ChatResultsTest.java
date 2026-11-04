package com.dartinsight.agent.service;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class ChatResultsTest {

    @Test
    @DisplayName("게시판 글 초안 본문은 근거 표시와 그 앞 공백만 빼고 문단 나눔(줄바꿈)은 그대로 둔다")
    void postBodyKeepsParagraphBreaks() {
        assertThat(ChatResults.postBody("첫 문단이에요 [1][2].\n\n둘째   문단이에요[3]."))
                .isEqualTo("첫 문단이에요.\n\n둘째 문단이에요.");
    }
}
