package com.dartinsight.glossary.domain;

/**
 * 카드 내용을 확인한 공식 자료.
 *
 * @param title 자료 이름
 * @param url   자료 주소. 없으면 확인한 출처로 보지 않는다
 */
public record GlossarySource(String title, String url) {

    /** 이름과 주소가 모두 있어 내보낼 수 있는 출처인지. */
    public boolean isComplete() {
        return title != null && !title.isBlank() && url != null && !url.isBlank();
    }
}
