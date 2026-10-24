package com.dartinsight.company.domain;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class CompanyNameKeyTest {

    @Test
    @DisplayName("key는 공백을 모두 빼고 소문자로 바꾼다")
    void keyRemovesAllWhitespaceAndLowercases() {
        assertThat(CompanyNameKey.key(" 삼성 전자 ")).isEqualTo("삼성전자");
        assertThat(CompanyNameKey.key("LG\tDisplay　Co Ltd\n")).isEqualTo("lgdisplaycoltd");
        assertThat(CompanyNameKey.key("50%할인_A")).isEqualTo("50%할인_a");
    }

    @Test
    @DisplayName("chosung은 한글 음절을 초성으로 바꾸고 다른 글자는 소문자로 남긴다")
    void chosungTurnsSyllablesIntoInitials() {
        assertThat(CompanyNameKey.chosung("삼성전자")).isEqualTo("ㅅㅅㅈㅈ");
        assertThat(CompanyNameKey.chosung("삼성 전자")).isEqualTo("ㅅㅅㅈㅈ");
        assertThat(CompanyNameKey.chosung("LG전자")).isEqualTo("lgㅈㅈ");
        assertThat(CompanyNameKey.chosung("까뚜빠싸짜")).isEqualTo("ㄲㄸㅃㅆㅉ");
        assertThat(CompanyNameKey.chosung("가힣")).isEqualTo("ㄱㅎ");
        assertThat(CompanyNameKey.chosung("(주)한국3")).isEqualTo("(ㅈ)ㅎㄱ3");
    }

    @Test
    @DisplayName("null은 null로 돌려준다")
    void nullStaysNull() {
        assertThat(CompanyNameKey.key(null)).isNull();
        assertThat(CompanyNameKey.chosung(null)).isNull();
        assertThat(CompanyNameKey.isChosungQuery(null)).isFalse();
    }

    @Test
    @DisplayName("공백을 뺀 검색어가 한글 자음만으로 2자 이상일 때만 초성 검색어다")
    void chosungQueryIsTwoOrMoreConsonantsOnly() {
        assertThat(CompanyNameKey.isChosungQuery("ㅅㅅㅈㅈ")).isTrue();
        assertThat(CompanyNameKey.isChosungQuery(" ㅅㅅ ㅈㅈ ")).isTrue();
        assertThat(CompanyNameKey.isChosungQuery("ㄱㅎ")).isTrue();
        assertThat(CompanyNameKey.isChosungQuery("ㅅ")).isFalse();
        assertThat(CompanyNameKey.isChosungQuery("ㅅ ")).isFalse();
        assertThat(CompanyNameKey.isChosungQuery("삼ㅅ")).isFalse();
        assertThat(CompanyNameKey.isChosungQuery("ㅅㅏ")).isFalse();
        assertThat(CompanyNameKey.isChosungQuery("lgㅈㅈ")).isFalse();
        assertThat(CompanyNameKey.isChosungQuery("삼성")).isFalse();
    }
}
